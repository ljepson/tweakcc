import { showDiff } from './index';

const SYNTHETIC_META_SENTINEL = '[Synthetic empty meta message]';
const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const writeSuppressNoContentPlaceholders = (
  oldFile: string
): string | null => {
  let nextFile = oldFile;

  const userMessageFactoryMatch = nextFile.match(
    /function ([$\w]+)\(\{content:([$\w]+),isMeta:[$\w]+,[\s\S]*?message:\{role:"user",content:\2\|\|([$\w]+)\}/
  );
  const constructorMatch = nextFile.match(
    /message:\{role:"user",content:([$\w]+)\|\|([$\w]+)\}/
  );

  if (!userMessageFactoryMatch || !constructorMatch) {
    console.error(
      'patch: suppressNoContentPlaceholders: failed to find user message constructor'
    );
    return null;
  }

  const [, userMessageFactory, , noContentVar] = userMessageFactoryMatch;
  const [constructorNeedle, constructorContentVar, constructorFallbackVar] =
    constructorMatch;
  const constructorReplacement = `message:{role:"user",content:${constructorContentVar}?${constructorContentVar}??"":${constructorContentVar}||${constructorFallbackVar}}`;

  if (constructorNeedle !== constructorReplacement) {
    const constructorIndex = constructorMatch.index!;
    const afterConstructorFile =
      nextFile.slice(0, constructorIndex) +
      constructorReplacement +
      nextFile.slice(constructorIndex + constructorNeedle.length);

    showDiff(
      nextFile,
      afterConstructorFile,
      constructorReplacement,
      constructorIndex,
      constructorIndex + constructorNeedle.length
    );
    nextFile = afterConstructorFile;
  }

  const assistantRepairMatch = nextFile.match(
    /tengu_fixed_empty_assistant_content",\{messageUUID:([$\w]+)\.uuid,messageIndex:([$\w]+)\}[\s\S]{0,200}?text:([$\w]+),citations:\[\]/
  );

  if (!assistantRepairMatch) {
    console.error(
      'patch: suppressNoContentPlaceholders: failed to find empty assistant repair'
    );
    return null;
  }

  const [, , , assistantTextVar] = assistantRepairMatch;
  const assistantNeedle = `text:${assistantTextVar},citations:[]`;
  const assistantReplacement = 'text:"[No message content]",citations:[]';
  if (assistantNeedle !== assistantReplacement) {
    const assistantIndex = nextFile.indexOf(
      assistantNeedle,
      assistantRepairMatch.index
    );
    const afterAssistantFile =
      nextFile.slice(0, assistantIndex) +
      assistantReplacement +
      nextFile.slice(assistantIndex + assistantNeedle.length);

    showDiff(
      nextFile,
      afterAssistantFile,
      assistantReplacement,
      assistantIndex,
      assistantIndex + assistantNeedle.length
    );
    nextFile = afterAssistantFile;
  }

  const toolRepairPattern = new RegExp(
    `${escapeRegex(userMessageFactory)}\\(\\{content:(?:""|${escapeRegex(
      noContentVar
    )}),isMeta:!0\\}\\)`,
    'g'
  );
  const toolRepairMatch = toolRepairPattern.exec(nextFile);
  if (toolRepairMatch) {
    const toolRepairIndex = toolRepairMatch.index;
    const syntheticMetaReplacement = `${userMessageFactory}({content:"${SYNTHETIC_META_SENTINEL}",isMeta:!0})`;
    const afterToolRepairFile = nextFile.replaceAll(
      toolRepairPattern,
      syntheticMetaReplacement
    );

    showDiff(
      nextFile,
      afterToolRepairFile,
      syntheticMetaReplacement,
      toolRepairIndex,
      toolRepairIndex + toolRepairMatch[0].length
    );
    nextFile = afterToolRepairFile;
  }

  return nextFile;
};
