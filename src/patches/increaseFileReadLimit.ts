// Please see the note about writing patches in ./index

import { LocationResult, showDiff } from './index';

/**
 * Find the file read token limit (25000) that's associated with file reading.
 *
 * Approach: Find "=25000," and verify a known anchor appears nearby to ensure
 * we're targeting the correct value. Supports multiple anchors across CC versions:
 * - "<system-reminder>" (CC <2.1.83)
 * - "tengu_amber_wren" (CC >=2.1.83)
 */
const getFileReadLimitLocation = (oldFile: string): LocationResult | null => {
  const anchors = ['<system-reminder>', 'tengu_amber_wren'];

  let match: RegExpMatchArray | null = null;
  for (const anchor of anchors) {
    const escaped = anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`=25000,([\\s\\S]{0,200})${escaped}`);
    match = oldFile.match(pattern);
    if (match && match.index !== undefined) {
      const startIndex = match.index + 1;
      const endIndex = startIndex + 5;
      return { startIndex, endIndex };
    }
  }

  const pattern2 =
    /CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS.{0,200}var [$\w]+=25000,/;

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
