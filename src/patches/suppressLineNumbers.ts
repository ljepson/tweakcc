// Please see the note about writing patches in ./index

import { LocationResult, showDiff } from './index';

/**
 * Find the location of the line number formatting function.
 *
 * The minified code looks like:
 *   if(J.length>=${NUM})return`${J}→${G}`;return`${J.padStart(${NUM}," ")}→${G}`
 *
 * This function formats line numbers with the arrow (→) character.
 * We want to find and replace this to just return the content without line numbers.
 */
const getLineNumberFormatterLocation = (
  oldFile: string
): LocationResult | null => {
  const patterns = [
    {
      pattern:
        /if\(([$\w]+)\.length>=\d+\)return`\$\{\1\}(?:→|\\u2192)\$\{([$\w]+)\}`;return`\$\{\1\.padStart\(\d+," "\)\}(?:→|\\u2192)\$\{\2\}`/,
      contentGroup: 2,
    },
    {
      pattern:
        /function [$\w]+\(([$\w]+),([$\w]+),([$\w]+)\)\{let ([$\w]+)=\1\.endsWith\("\\r"\)\?\1\.slice\(0,-1\):\1;if\(\3\)return`\$\{\2\}\t\$\{([$\w]+)\}`;let ([$\w]+)=String\(\2\);return \6\.length>=\d+\?`\$\{\6\}(?:→|\\u2192)\$\{\4\}`:`\$\{\6\.padStart\(\d+," "\)\}(?:→|\\u2192)\$\{\4\}` ?\}/,
      contentGroup: 4,
    },
  ];
  const matched = patterns
    .map(({ pattern, contentGroup }) => {
      const match = oldFile.match(pattern);
      return match && match.index !== undefined
        ? { match, contentGroup }
        : null;
    })
    .find(
      (value): value is { match: RegExpMatchArray; contentGroup: number } =>
        value !== null
    );

  if (!matched) {
    console.error(
      'patch: suppressLineNumbers: failed to find line number formatter pattern'
    );
    return null;
  }
  const { match, contentGroup } = matched;
  const startIndex = match.index!;

  return {
    startIndex,
    endIndex: startIndex + match[0].length,
    identifiers: [match[1], match[contentGroup]],
  };
};

export const writeSuppressLineNumbers = (oldFile: string): string | null => {
  const location = getLineNumberFormatterLocation(oldFile);
  if (!location) {
    return null;
  }

  const contentVar = location.identifiers?.[1];
  if (!contentVar) {
    console.error('patch: suppressLineNumbers: content variable not captured');
    return null;
  }

  // Replace the entire line number formatting logic with just returning the content
  const newCode = `return ${contentVar}`;
  const newFile =
    oldFile.slice(0, location.startIndex) +
    newCode +
    oldFile.slice(location.endIndex);

  showDiff(oldFile, newFile, newCode, location.startIndex, location.endIndex);
  return newFile;
};
