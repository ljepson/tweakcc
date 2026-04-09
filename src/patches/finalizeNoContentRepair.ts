import { showDiff } from './index';

const SYNTHETIC_META_SENTINEL = '[Synthetic empty meta message]';
const EMPTY_TOOL_REPAIR_NEEDLE = 'n$({content:"",isMeta:!0})';
const NO_CONTENT_TOOL_REPAIR_NEEDLE = 'n$({content:vN,isMeta:!0})';

export const writeFinalizeNoContentRepair = (
  oldFile: string
): string | null => {
  const needsRewrite =
    oldFile.includes(NO_CONTENT_TOOL_REPAIR_NEEDLE) ||
    oldFile.includes(EMPTY_TOOL_REPAIR_NEEDLE);

  if (!needsRewrite) {
    return oldFile;
  }

  const replacement = `n$({content:"${SYNTHETIC_META_SENTINEL}",isMeta:!0})`;
  const index = [
    oldFile.indexOf(NO_CONTENT_TOOL_REPAIR_NEEDLE),
    oldFile.indexOf(EMPTY_TOOL_REPAIR_NEEDLE),
  ].find(value => value !== -1)!;
  const newFile = oldFile
    .replaceAll(NO_CONTENT_TOOL_REPAIR_NEEDLE, replacement)
    .replaceAll(EMPTY_TOOL_REPAIR_NEEDLE, replacement);

  showDiff(
    oldFile,
    newFile,
    replacement,
    index,
    index + NO_CONTENT_TOOL_REPAIR_NEEDLE.length
  );
  return newFile;
};
