// Please see the note about writing patches in ./index

import { LocationResult, showDiff } from './index';

/**
 * Find the file read token limit (25000) that's associated with the system-reminder.
 *
 * Approach: Find "=25000," and verify "<system-reminder>" appears within
 * the next ~100 characters to ensure we're targeting the correct value.
 */
const getFileReadLimitLocation = (oldFile: string): LocationResult | null => {
  // CC <2.1.87: =25000, followed within ~100 chars by <system-reminder>
  const pattern1 = /=25000,([\s\S]{0,100})<system-reminder>/;
  // CC 2.1.87+: CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS...var ii1=25000,
  const pattern2 =
    /CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS.{0,200}var [$\w]+=25000,/;

  let match = oldFile.match(pattern1);
  if (match && match.index !== undefined) {
    const startIndex = match.index + 1;
    const endIndex = startIndex + 5;
    return { startIndex, endIndex };
  }

  match = oldFile.match(pattern2);
  if (match && match.index !== undefined) {
    // The "25000" starts at match.index + 4 + varname.length + 1 (after "var X=")
    // Find exact position of "25000" within the match
    const offset = match[0].indexOf('=25000,');
    const startIndex = match.index + offset + 1;
    const endIndex = startIndex + 5;
    return { startIndex, endIndex };
  }

  console.error(
    'patch: increaseFileReadLimit: failed to find 25000 token limit'
  );
  return null;
};

export const writeIncreaseFileReadLimit = (oldFile: string): string | null => {
  const location = getFileReadLimitLocation(oldFile);
  if (!location) {
    return null;
  }

  const newValue = '1000000';
  const newFile =
    oldFile.slice(0, location.startIndex) +
    newValue +
    oldFile.slice(location.endIndex);

  showDiff(oldFile, newFile, newValue, location.startIndex, location.endIndex);
  return newFile;
};
