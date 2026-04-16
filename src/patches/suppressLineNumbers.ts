// Please see the note about writing patches in ./index

import { LocationResult, showDiff } from './index';

interface LineNumberFormatterLocation extends LocationResult {
  newCode: string;
}

/**
 * Find the location of the line number formatting function.
 *
 * The minified code looks like:
 *   if(J.length>=${NUM})return`${J}→${G}`;return`${J.padStart(${NUM}," ")}→${G}`
 *
 * This function formats line numbers with the arrow (→) character.
 * We want to find and replace this to just return the content without line numbers.
 */
const getLineNumberFormatterLocation = (
  oldFile: string
): LineNumberFormatterLocation | null => {
  const patterns = [
    {
      pattern:
        /if\(([$\w]+)\.length>=\d+\)return`\$\{\1\}(?:→|\\u2192)\$\{([$\w]+)\}`;return`\$\{\1\.padStart\(\d+," "\)\}(?:→|\\u2192)\$\{\2\}`/,
      getNewCode: (match: RegExpMatchArray) => `return ${match[2]};`,
    },
    {
      pattern:
        /function ([$\w]+)\(([$\w]+),([$\w]+),([$\w]+)\)\{let ([$\w]+)=\2\.endsWith\("\\r"\)\?\2\.slice\(0,-1\):\2;if\(\4\)return`\$\{\3\}\t\$\{([$\w]+)\}`;let ([$\w]+)=String\(\3\);return \7\.length>=\d+\?`\$\{\7\}(?:→|\\u2192)\$\{\5\}`:`\$\{\7\.padStart\(\d+," "\)\}(?:→|\\u2192)\$\{\5\}` ?\}/,
      getNewCode: (match: RegExpMatchArray) =>
        `function ${match[1]}(${match[2]},${match[3]},${match[4]}){let ${match[5]}=${match[2]}.endsWith("\\r")?${match[2]}.slice(0,-1):${match[2]};return ${match[5]}}`,
    },
  ];
  const matched = patterns
    .map(({ pattern, getNewCode }) => {
      const match = oldFile.match(pattern);
      return match && match.index !== undefined
        ? { match, newCode: getNewCode(match) }
        : null;
    })
    .find(
      (value): value is { match: RegExpMatchArray; newCode: string } =>
        value !== null
    );

  if (!matched) {
    console.error(
      'patch: suppressLineNumbers: failed to find line number formatter pattern'
    );
    return null;
  }
  const { match, newCode } = matched;
  const startIndex = match.index!;

  return {
    startIndex,
    endIndex: startIndex + match[0].length,
    identifiers: [match[1]],
    newCode,
  };
};

export const writeSuppressLineNumbers = (oldFile: string): string | null => {
  const location = getLineNumberFormatterLocation(oldFile);
  if (!location) {
    return null;
  }

  const newFile =
    oldFile.slice(0, location.startIndex) +
    location.newCode +
    oldFile.slice(location.endIndex);

  showDiff(
    oldFile,
    newFile,
    location.newCode,
    location.startIndex,
    location.endIndex
  );
  return newFile;
};
