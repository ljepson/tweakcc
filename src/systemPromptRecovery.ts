import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CONFIG_DIR,
  NATIVE_BINARY_BACKUP_FILE,
  PROMPT_CACHE_DIR,
} from './config';
import { extractClaudeJsFromNativeInstallation } from './nativeInstallationLoader';
import type { StringsFile, StringsPrompt } from './systemPromptSync';
import { debug } from './utils';

const BUNDLED_PROMPTS_DIR = fileURLToPath(
  new URL('../data/prompts/', import.meta.url)
);
const DISCOVERY_MANIFEST_SUFFIX = '.discovery.json';
const MIN_DISCOVERED_PROMPT_LENGTH = 350;

const compareVersionsDesc = (left: string, right: string): number => {
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;
    if (leftPart !== rightPart) {
      return rightPart - leftPart;
    }
  }

  return 0;
};

const escapeRegex = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const escapeNonAsciiForRegex = (text: string): string => {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[^\x00-\x7F]/g, char => {
    const codePoint = char.charCodeAt(0);
    const escapedU = `\\\\u${codePoint.toString(16).padStart(4, '0')}`;
    const escapedChar = escapeRegex(char);
    if (codePoint <= 0xff) {
      const escapedX = `\\\\x${codePoint.toString(16).padStart(2, '0').toUpperCase()}`;
      return `(?:${escapedChar}|${escapedU}|${escapedX})`;
    }
    return `(?:${escapedChar}|${escapedU})`;
  });
};

const buildSearchRegexFromPieces = (
  pieces: string[],
  ccVersion: string,
  buildTime?: string
): string => {
  let pattern = '';

  for (let index = 0; index < pieces.length; index += 1) {
    let piece = pieces[index].replace(/<<CCVERSION>>/g, ccVersion);

    if (buildTime) {
      piece = piece.replace(/<<BUILD_TIME>>/g, buildTime);
    }

    const escapedPiece = escapeRegex(piece);
    const withNonAsciiHandling = escapeNonAsciiForRegex(escapedPiece);
    const withNewlineHandling = withNonAsciiHandling.replace(
      /\n/g,
      '(?:[\\\\]r)?(?:\n|\\\\n)'
    );
    pattern += withNewlineHandling;

    if (index < pieces.length - 1) {
      pattern += '([\\w$]+)';
    }
  }

  return pattern;
};

const slugify = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

const normalizeWhitespace = (text: string): string =>
  text.replace(/\s+/g, ' ').trim();

const extractFirstMeaningfulLine = (content: string): string => {
  const lines = content
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const normalized = line.replace(/^#+\s*/, '').replace(/^[-*]\s+/, '');
    if (
      normalized.length >= 8 &&
      !normalized.startsWith('```') &&
      !normalized.startsWith('|')
    ) {
      return normalized;
    }
  }

  return normalizeWhitespace(content).slice(0, 80);
};

const scorePromptLikeContent = (content: string): number => {
  let score = 0;

  if (content.length >= MIN_DISCOVERED_PROMPT_LENGTH) {
    score += 1;
  }
  if ((content.match(/\n/g) ?? []).length >= 4) {
    score += 1;
  }
  if (
    /(^|\n)(You are|Your task|IMPORTANT:|## |# |---\n|Use this|When done|CRITICAL|OBJECTIVE:)/m.test(
      content
    )
  ) {
    score += 2;
  }
  if (
    /(allowed-tools:|<example>|<\/example>|JSON object|tool_result|system prompt|Claude Code)/.test(
      content
    )
  ) {
    score += 1;
  }
  if (/[.!?]\n[A-Z]/.test(content)) {
    score += 1;
  }

  return score;
};

const buildSyntheticPromptName = (content: string): string => {
  const firstLine = extractFirstMeaningfulLine(content);
  if (firstLine.startsWith('Skill:')) {
    return firstLine;
  }
  if (firstLine.startsWith('Data:')) {
    return firstLine;
  }
  if (firstLine.startsWith('# ')) {
    return firstLine.slice(2);
  }
  if (content.startsWith('# ')) {
    return content.slice(2).split('\n')[0].trim();
  }
  return firstLine.slice(0, 80);
};

const buildSyntheticPromptDescription = (content: string): string => {
  const normalized = normalizeWhitespace(content);
  if (normalized.length <= 140) {
    return normalized;
  }
  return `${normalized.slice(0, 137).trimEnd()}...`;
};

const buildSyntheticPromptId = (content: string): string => {
  const nameSlug = slugify(buildSyntheticPromptName(content)) || 'prompt';
  const hash = createHash('sha1').update(content).digest('hex').slice(0, 10);
  return `discovered-${nameSlug}-${hash}`;
};

const isRangeCovered = (
  start: number,
  end: number,
  ranges: Array<{ start: number; end: number }>
): boolean => ranges.some(range => start < range.end && end > range.start);

const discoverPromptsFromContent = (
  version: string,
  content: string,
  matchedRanges: Array<{ start: number; end: number }>
): {
  prompts: StringsPrompt[];
  manifest: Array<Record<string, string | number>>;
} => {
  const discovered = new Map<string, StringsPrompt>();
  const manifest: Array<Record<string, string | number>> = [];
  const templateLiteralPattern = /var ([A-Za-z_$][\w$]*)=`([\s\S]*?)`;/g;
  const stringLiteralPattern =
    /var ([A-Za-z_$][\w$]*)="((?:\\.|[^"\\]){350,})";/g;

  const registerCandidate = (
    variableName: string,
    rawContent: string,
    start: number,
    end: number,
    sourceType: 'template' | 'string'
  ): void => {
    if (isRangeCovered(start, end, matchedRanges)) {
      return;
    }

    const decoded =
      sourceType === 'string'
        ? rawContent
            .replace(/\\r\\n/g, '\n')
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/\\`/g, '`')
            .replace(/\\\\/g, '\\')
        : rawContent;

    const score = scorePromptLikeContent(decoded);
    if (score < 4) {
      return;
    }

    const id = buildSyntheticPromptId(decoded);
    if (discovered.has(id)) {
      return;
    }

    discovered.set(id, {
      id,
      name: buildSyntheticPromptName(decoded),
      description: buildSyntheticPromptDescription(decoded),
      pieces: [decoded],
      identifiers: [],
      identifierMap: {},
      version,
    });

    manifest.push({
      id,
      variableName,
      sourceType,
      score,
      length: decoded.length,
      preview: normalizeWhitespace(decoded).slice(0, 160),
    });
  };

  for (const match of content.matchAll(templateLiteralPattern)) {
    const [fullMatch, variableName, promptContent] = match;
    const start = match.index ?? 0;
    registerCandidate(
      variableName,
      promptContent,
      start,
      start + fullMatch.length,
      'template'
    );
  }

  for (const match of content.matchAll(stringLiteralPattern)) {
    const [fullMatch, variableName, promptContent] = match;
    const start = match.index ?? 0;
    registerCandidate(
      variableName,
      promptContent,
      start,
      start + fullMatch.length,
      'string'
    );
  }

  return {
    prompts: [...discovered.values()],
    manifest,
  };
};

const getExtractedNativeJsFile = (): string =>
  path.join(CONFIG_DIR, 'native-claudejs-orig.js');

const extractBuildTime = (content: string): string | undefined => {
  const match = content.match(
    /\bBUILD_TIME:"(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)"/
  );
  return match ? match[1] : undefined;
};

const extractVersion = (content: string): string | undefined => {
  const match = content.match(/\bVERSION:"([^"]+)"/);
  return match ? match[1] : undefined;
};

const readStringsFilesFromDir = async (
  dirPath: string
): Promise<StringsFile[]> => {
  try {
    const entries = await fs.readdir(dirPath);
    const files = entries
      .filter(entry => /^prompts-\d+\.\d+\.\d+\.json$/.test(entry))
      .sort((left, right) =>
        compareVersionsDesc(
          left.replace(/^prompts-/, '').replace(/\.json$/, ''),
          right.replace(/^prompts-/, '').replace(/\.json$/, '')
        )
      );

    return await Promise.all(
      files.map(async fileName => {
        const fullPath = path.join(dirPath, fileName);
        const raw = await fs.readFile(fullPath, 'utf8');
        return JSON.parse(raw) as StringsFile;
      })
    );
  } catch {
    return [];
  }
};

const loadPromptSources = async (): Promise<StringsFile[]> => {
  const [cached, bundled] = await Promise.all([
    readStringsFilesFromDir(PROMPT_CACHE_DIR),
    readStringsFilesFromDir(BUNDLED_PROMPTS_DIR),
  ]);
  const byVersion = new Map<string, StringsFile>();

  for (const source of [...cached, ...bundled]) {
    if (!byVersion.has(source.version)) {
      byVersion.set(source.version, source);
    }
  }

  return [...byVersion.values()].sort((left, right) =>
    compareVersionsDesc(left.version, right.version)
  );
};

const readClaudeJsForVersion = async (
  version: string,
  nativeInstallationPath?: string
): Promise<string | null> => {
  try {
    const extractedJs = await fs.readFile(getExtractedNativeJsFile(), 'utf8');
    if (extractVersion(extractedJs) === version) {
      return extractedJs;
    }
  } catch (error) {
    debug(
      `recoverStringsFile: failed to read extracted JS cache: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  const extractionCandidates = [
    nativeInstallationPath,
    NATIVE_BINARY_BACKUP_FILE,
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of extractionCandidates) {
    try {
      const extracted = await extractClaudeJsFromNativeInstallation(candidate);
      if (!extracted) {
        continue;
      }
      const content = extracted.toString('utf8');
      if (extractVersion(content) === version) {
        return content;
      }
    } catch (error) {
      debug(
        `recoverStringsFile: failed to extract JS from ${candidate}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  return null;
};

export const recoverStringsFileFromContent = (
  version: string,
  content: string,
  sources: StringsFile[]
): StringsFile | null => {
  const buildTime = extractBuildTime(content);
  const recovered = new Map<string, StringsPrompt>();
  const order = new Map<string, number>();
  const matchedRanges: Array<{ start: number; end: number }> = [];
  let nextOrder = 0;

  for (const source of sources) {
    for (const prompt of source.prompts) {
      if (!order.has(prompt.id)) {
        order.set(prompt.id, nextOrder);
        nextOrder += 1;
      }

      if (recovered.has(prompt.id)) {
        continue;
      }

      const regex = new RegExp(
        buildSearchRegexFromPieces(prompt.pieces, version, buildTime),
        'si'
      );

      const match = content.match(regex);
      if (!match || match.index === undefined) {
        continue;
      }

      matchedRanges.push({
        start: match.index,
        end: match.index + match[0].length,
      });

      recovered.set(prompt.id, {
        ...prompt,
        version,
      });
    }
  }

  const discovered = discoverPromptsFromContent(
    version,
    content,
    matchedRanges
  );
  for (const prompt of discovered.prompts) {
    if (!order.has(prompt.id)) {
      order.set(prompt.id, nextOrder);
      nextOrder += 1;
    }
    recovered.set(prompt.id, prompt);
  }

  if (recovered.size === 0) {
    return null;
  }

  return {
    version,
    prompts: [...recovered.values()].sort((left, right) => {
      const leftOrder = order.get(left.id) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = order.get(right.id) ?? Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder;
    }),
  };
};

export const recoverStringsFile = async (
  version: string,
  nativeInstallationPath?: string
): Promise<StringsFile | null> => {
  const [content, sources] = await Promise.all([
    readClaudeJsForVersion(version, nativeInstallationPath),
    loadPromptSources(),
  ]);

  if (!content || sources.length === 0) {
    return null;
  }

  const recovered = recoverStringsFileFromContent(version, content, sources);
  if (!recovered) {
    return null;
  }

  await fs.mkdir(PROMPT_CACHE_DIR, { recursive: true });
  await fs.writeFile(
    path.join(PROMPT_CACHE_DIR, `prompts-${version}.json`),
    JSON.stringify(recovered, null, 2),
    'utf8'
  );

  const discoveredOnly = recovered.prompts.filter(prompt =>
    prompt.id.startsWith('discovered-')
  );
  await fs.writeFile(
    path.join(
      PROMPT_CACHE_DIR,
      `prompts-${version}${DISCOVERY_MANIFEST_SUFFIX}`
    ),
    JSON.stringify(
      discoveredOnly.map(prompt => ({
        id: prompt.id,
        name: prompt.name,
        description: prompt.description,
        length: prompt.pieces[0]?.length ?? 0,
      })),
      null,
      2
    ),
    'utf8'
  );

  debug(
    `recoverStringsFile: recovered ${recovered.prompts.length} prompts for ${version}`
  );

  return recovered;
};
