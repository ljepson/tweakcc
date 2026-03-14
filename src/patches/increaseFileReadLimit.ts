// Please see the note about writing patches in ./index

import { LocationResult, showDiff } from './index';

/**
 * Find the file read token limit (25000) that's associated with the system-reminder.
 *
 * Approach: Find "=25000," and verify "<system-reminder>" appears within
 * the next ~100 characters to ensure we're targeting the correct value.
 */
const getFileReadLimitLocation = (oldFile: string): LocationResult | null => {
  // Pattern: =25000, verified by CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS
  // or <system-reminder> appearing nearby
  const pattern =
    /CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS[\s\S]{0,300}?=25000,|=25000,[\s\S]{0,100}<system-reminder>/;
  const match = oldFile.match(pattern);

  if (!match || match.index === undefined) {
    console.error(
      'patch: increaseFileReadLimit: failed to find 25000 token limit near system-reminder'
    );
    return null;
  }

  // Find the exact "=25000," within the match
  const matchStr = match[0];
  const eqPos = matchStr.lastIndexOf('=25000,');
  const startIndex = match.index + eqPos + 1;
  const endIndex = startIndex + 5;

  return {
    startIndex,
    endIndex,
  };
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
