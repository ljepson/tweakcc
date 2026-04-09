import { showDiff } from './index';

const SYNTHETIC_META_SENTINEL = '[Synthetic empty meta message]';
const EMPTY_TOOL_REPAIR_NEEDLE = 'n$({content:"",isMeta:!0})';
const NO_CONTENT_TOOL_REPAIR_NEEDLE = 'n$({content:vN,isMeta:!0})';
const LEGACY_NO_CONTENT_TOOL_REPAIR_NEEDLE = 'n$({content:rV,isMeta:!0})';
const SYNTHETIC_META_REPLACEMENT = `n$({content:"${SYNTHETIC_META_SENTINEL}",isMeta:!0})`;

export const writeSuppressNoContentPlaceholders = (
  oldFile: string
): string | null => {
  let nextFile = oldFile;

  const constructorNeedles = [
    'message:{role:"user",content:H||vN}',
    'message:{role:"user",content:H||rV}',
  ];
  const constructorNeedle = constructorNeedles.find(needle =>
    nextFile.includes(needle)
  );

  if (!constructorNeedle) {
    console.error(
      'patch: suppressNoContentPlaceholders: failed to find user message constructor'
    );
    return null;
  }

  const constructorReplacement = constructorNeedle.replace(
    'content:H||',
    'content:$?H??"":H||'
  );
  if (constructorNeedle !== constructorReplacement) {
    const constructorIndex = nextFile.indexOf(constructorNeedle);
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

  const assistantRepairNeedles = ['text:vN', 'text:rV'];
  const assistantRepairNeedle = assistantRepairNeedles.find(needle =>
    nextFile.includes(
      `tengu_fixed_empty_assistant_content",{messageUUID:K.uuid,messageIndex:_}),{...K,message:{...K.message,content:[{type:"text",${needle},citations:[]}]}}`
    )
  );

  if (!assistantRepairNeedle) {
    console.error(
      'patch: suppressNoContentPlaceholders: failed to find empty assistant repair'
    );
    return null;
  }

  const assistantNeedle = `tengu_fixed_empty_assistant_content",{messageUUID:K.uuid,messageIndex:_}),{...K,message:{...K.message,content:[{type:"text",${assistantRepairNeedle},citations:[]}]}}`;
  const assistantReplacement = assistantNeedle.replace(
    assistantRepairNeedle,
    'text:"[No message content]"'
  );
  if (assistantNeedle !== assistantReplacement) {
    const assistantIndex = nextFile.indexOf(assistantNeedle);
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

  const toolRepairNeedsRewrite =
    nextFile.includes(NO_CONTENT_TOOL_REPAIR_NEEDLE) ||
    nextFile.includes(LEGACY_NO_CONTENT_TOOL_REPAIR_NEEDLE) ||
    nextFile.includes(EMPTY_TOOL_REPAIR_NEEDLE);
  if (toolRepairNeedsRewrite) {
    const toolRepairIndex = [
      nextFile.indexOf(NO_CONTENT_TOOL_REPAIR_NEEDLE),
      nextFile.indexOf(LEGACY_NO_CONTENT_TOOL_REPAIR_NEEDLE),
      nextFile.indexOf(EMPTY_TOOL_REPAIR_NEEDLE),
    ].find(index => index !== -1)!;
    const afterToolRepairFile = nextFile
      .replaceAll(NO_CONTENT_TOOL_REPAIR_NEEDLE, SYNTHETIC_META_REPLACEMENT)
      .replaceAll(
        LEGACY_NO_CONTENT_TOOL_REPAIR_NEEDLE,
        SYNTHETIC_META_REPLACEMENT
      )
      .replaceAll(EMPTY_TOOL_REPAIR_NEEDLE, SYNTHETIC_META_REPLACEMENT);

    showDiff(
      nextFile,
      afterToolRepairFile,
      SYNTHETIC_META_REPLACEMENT,
      toolRepairIndex,
      toolRepairIndex + NO_CONTENT_TOOL_REPAIR_NEEDLE.length
    );
    nextFile = afterToolRepairFile;
  }

  return nextFile;
};
