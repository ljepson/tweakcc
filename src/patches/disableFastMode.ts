// Please see the note about writing patches in ./index

import { showDiff } from './index';

export const writeDisableFastMode = (file: string): string | null => {
  const pattern =
    /function ([$\w]+)\(\)\{if\([$\w]+\(\)!=="firstParty"\)return!1;return![$\w]+\(process\.env\.CLAUDE_CODE_DISABLE_FAST_MODE\)\}/;

  const match = file.match(pattern);
  if (!match || match.index === undefined) {
    if (!file.includes('CLAUDE_CODE_DISABLE_FAST_MODE')) {
      return file;
    }
    console.error('patch: disableFastMode: failed to find fast mode gate');
    return null;
  }

  const replacement = `function ${match[1]}(){return!1}`;
  const startIndex = match.index;
  const endIndex = startIndex + match[0].length;

  const newFile =
    file.slice(0, startIndex) + replacement + file.slice(endIndex);

  showDiff(file, newFile, replacement, startIndex, endIndex);
  return newFile;
};
