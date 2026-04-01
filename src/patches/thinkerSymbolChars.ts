// Please see the note about writing patches in ./index

import { LocationResult, showDiff } from './index';

export const writeThinkerSymbolChars = (
  oldFile: string,
  symbols: string[]
): string | null => {
  const symbolsJson = JSON.stringify(symbols);

  if (oldFile.includes(symbolsJson)) {
    return oldFile;
  }

  const locations: LocationResult[] = [];
  const arrayPattern =
    /\["(?:[·✢*✳✶✻✽]|\\u00b7|\\xb7|\\u2722|\\x2a|\\u002a|\\u2733|\\u2736|\\u273b|\\u273d)",\s*(?:"(?:[·✢*✳✶✻✽]|\\u00b7|\\xb7|\\u2722|\\x2a|\\u002a|\\u2733|\\u2736|\\u273b|\\u273d)",?\s*)+\]/gi;
  const functionPattern =
    /function ([$\w]+)\(\)\{if\(process\.env\.TERM==="xterm-ghostty"\)return\[[^\]]+\];return\[[^\]]+\]\}/g;

  let match;
  while ((match = arrayPattern.exec(oldFile)) !== null) {
    locations.push({
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  while ((match = functionPattern.exec(oldFile)) !== null) {
    const replacement =
      `function ${match[1]}(){` +
      `if(process.env.TERM==="xterm-ghostty")return${symbolsJson};` +
      `return${symbolsJson}}`;

    locations.push({
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      replacement,
    } as LocationResult & { replacement: string });
  }

  if (locations.length === 0) {
    console.error(
      'patch: thinkerSymbolChars: could not find any thinker symbol char arrays'
    );
    return null;
  }

  // Sort locations by start index in descending order to apply from end to beginning.
  const sortedLocations = locations.sort((a, b) => b.startIndex - a.startIndex);

  let newFile = oldFile;
  for (let i = 0; i < sortedLocations.length; i++) {
    const replacement =
      'replacement' in sortedLocations[i]
        ? (sortedLocations[i] as LocationResult & { replacement: string })
            .replacement
        : symbolsJson;
    const updatedFile =
      newFile.slice(0, sortedLocations[i].startIndex) +
      replacement +
      newFile.slice(sortedLocations[i].endIndex);

    showDiff(
      newFile,
      updatedFile,
      replacement,
      sortedLocations[i].startIndex,
      sortedLocations[i].endIndex
    );
    newFile = updatedFile;
  }

  return newFile;
};
