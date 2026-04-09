import { showDiff } from './index';

export const writeFinalizeNoContentRepair = (
  oldFile: string
): string | null => {
  const needle = 'n$({content:vN,isMeta:!0})';

  if (!oldFile.includes(needle)) {
    return oldFile;
  }

  const replacement = 'n$({content:"",isMeta:!0})';
  const index = oldFile.indexOf(needle);
  const newFile = oldFile.replaceAll(needle, replacement);

  showDiff(oldFile, newFile, replacement, index, index + needle.length);
  return newFile;
};
