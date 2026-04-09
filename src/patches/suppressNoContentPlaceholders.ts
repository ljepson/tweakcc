import { showDiff } from './index';

const SYNTHETIC_META_SENTINEL = '[Synthetic empty meta message]';
const EMPTY_TOOL_REPAIR_NEEDLE = 'n$({content:"",isMeta:!0})';
const NO_CONTENT_TOOL_REPAIR_NEEDLE = 'n$({content:vN,isMeta:!0})';
const SYNTHETIC_META_REPLACEMENT = `n$({content:"${SYNTHETIC_META_SENTINEL}",isMeta:!0})`;

export const writeSuppressNoContentPlaceholders = (
  oldFile: string
): string | null => {
  let nextFile = oldFile;

  const constructorPattern =
    /function n\$\(\{content:H,isMeta:\$,isVisibleInTranscriptOnly:q,isVirtual:K,isCompactSummary:_,summarizeMetadata:f,toolUseResult:A,mcpMeta:z,uuid:O,timestamp:Y,imagePasteIds:M,sourceToolAssistantUUID:w,permissionMode:D,origin:j\}\)\{return\{type:"user",message:\{role:"user",content:H\|\|vN\}/;
  const constructorMatch = nextFile.match(constructorPattern);

  if (!constructorMatch || constructorMatch.index === undefined) {
    console.error(
      'patch: suppressNoContentPlaceholders: failed to find user message constructor'
    );
    return null;
  }

  const constructorNeedle = constructorMatch[0];
  if (!constructorNeedle.includes('content:$?H??"":H||vN')) {
    const constructorReplacement = constructorNeedle.replace(
      'content:H||vN',
      'content:$?H??"":H||vN'
    );
    const constructorIndex = constructorMatch.index;
    nextFile =
      nextFile.slice(0, constructorIndex) +
      constructorReplacement +
      nextFile.slice(constructorIndex + constructorNeedle.length);

    showDiff(
      oldFile,
      nextFile,
      constructorReplacement,
      constructorIndex,
      constructorIndex + constructorNeedle.length
    );
  }

  const assistantRepairPattern =
    /function O81\(H\)\{if\(H\.length===0\)return H;let \$=!1,q=H\.map\(\(K,_\)=>\{if\(K\.type!=="assistant"\)return K;if\(_===H\.length-1\)return K;let f=K\.message\.content;if\(Array\.isArray\(f\)&&f\.length===0\)return \$=!0,Q\("tengu_fixed_empty_assistant_content",\{messageUUID:K\.uuid,messageIndex:_\}\),\{\.\.\.K,message:\{\.\.\.K\.message,content:\[\{type:"text",text:vN,citations:\[\]\}\]\}\};return K\}\);return \$\?q:H\}/;
  const assistantRepairMatch = nextFile.match(assistantRepairPattern);

  if (!assistantRepairMatch || assistantRepairMatch.index === undefined) {
    console.error(
      'patch: suppressNoContentPlaceholders: failed to find empty assistant repair'
    );
    return null;
  }

  const assistantNeedle = assistantRepairMatch[0];
  if (!assistantNeedle.includes('text:"[No message content]"')) {
    const assistantReplacement = assistantNeedle.replace(
      'text:vN',
      'text:"[No message content]"'
    );
    const assistantIndex = assistantRepairMatch.index;
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
    nextFile.includes(EMPTY_TOOL_REPAIR_NEEDLE);
  if (toolRepairNeedsRewrite) {
    const toolRepairIndex = [
      nextFile.indexOf(NO_CONTENT_TOOL_REPAIR_NEEDLE),
      nextFile.indexOf(EMPTY_TOOL_REPAIR_NEEDLE),
    ].find(index => index !== -1)!;
    const afterToolRepairFile = nextFile
      .replaceAll(NO_CONTENT_TOOL_REPAIR_NEEDLE, SYNTHETIC_META_REPLACEMENT)
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
