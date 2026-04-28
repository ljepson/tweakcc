// Please see the note about writing patches in ./index

import { showDiff } from './index';

export const writeSuppressBillingHeader = (file: string): string | null => {
  const pattern = /return ([$\w]+)\(`attribution header \$\{([$\w]+)\}`\),\2/;

  const match = file.match(pattern);
  if (!match || match.index === undefined) {
    if (!file.includes('x-anthropic-billing-header')) {
      return file;
    }
    console.error(
      'patch: suppressBillingHeader: failed to find attribution header return'
    );
    return null;
  }

  const replacement = 'return""';
  const startIndex = match.index;
  const endIndex = startIndex + match[0].length;

  const newFile =
    file.slice(0, startIndex) + replacement + file.slice(endIndex);

  showDiff(file, newFile, replacement, startIndex, endIndex);
  return newFile;
};
