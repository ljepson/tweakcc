// Please see the note about writing patches in ./index

import { LocationResult, showDiff } from './index';

const getStartupBannerLocation = (oldFile: string): LocationResult | null => {
  // CC <2.1.87: Find the createElement with isBeforeFirstMessage:!1
  const pattern1 =
    /,[$\w]+\.createElement\([$\w]+,\{isBeforeFirstMessage:!1\}\),/;
  const match1 = oldFile.match(pattern1);

  if (match1 && match1.index !== undefined) {
    return {
      startIndex: match1.index,
      endIndex: match1.index + match1[0].length,
    };
  }

  // CC 2.1.87+: Find the welcome/banner component function by its
  // "Welcome to Claude Code" string and Apple_Terminal branch.
  // Pattern: function NAME(){...Apple_Terminal...Welcome to Claude Code...}
  const pattern2 =
    /function ([$\w]+)\(\)\{let [$\w]+=[$\w]+\.[$\w]+\(\d+\).{0,200}Apple_Terminal.{0,200}Welcome to Claude Code/;
  const match2 = oldFile.match(pattern2);

  if (match2 && match2.index !== undefined) {
    // Return the position right after the opening brace for injection
    const braceIdx = match2.index + match2[0].indexOf('{');
    return {
      startIndex: braceIdx + 1,
      endIndex: braceIdx + 1,
    };
  }

  console.error(
    'patch: hideStartupBanner: failed to find startup banner component'
  );
  return null;
};

export const writeHideStartupBanner = (oldFile: string): string | null => {
  const location = getStartupBannerLocation(oldFile);
  if (!location) {
    return null;
  }

  if (location.startIndex === location.endIndex) {
    // CC 2.1.87+: inject return null at function body start
    const insertion = 'return null;';
    const newFile =
      oldFile.slice(0, location.startIndex) +
      insertion +
      oldFile.slice(location.endIndex);
    showDiff(
      oldFile,
      newFile,
      insertion,
      location.startIndex,
      location.endIndex
    );
    return newFile;
  }

  // CC <2.1.87: remove the element
  const newFile =
    oldFile.slice(0, location.startIndex) +
    ',' +
    oldFile.slice(location.endIndex);

  showDiff(oldFile, newFile, ',', location.startIndex, location.endIndex);
  return newFile;
};
