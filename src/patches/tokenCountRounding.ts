// Please see the note about writing patches in ./index

import { showDiff } from './index';

/**
 * Rounds the displayed token count to the nearest multiple of a given base value.
 *
 * This patch modifies the token count display so that instead of showing exact
 * values like "1234 tokens", it shows rounded values like "1200 tokens" (when
 * base is 100).
 *
 * The patch supports two different patterns for different Claude Code versions:
 *
 * Newer versions (CC 2.x+):
 * ```
 * overrideMessage:..., VAR=FUNC(EXPR),...key:"tokens"..., VAR," tokens"
 * ```
 *
 * Older versions (CC 1.x):
 * ```
 * overrideMessage:...,key:"tokens"...FUNC(Math.round(...))
 * ```
 *
 * The token expression is wrapped with: Math.round((EXPR)/base)*base
 */
export const writeTokenCountRounding = (
  oldFile: string,
  roundingBase: number
): string | null => {
  let fullMatch: string;
  let pre: string;
  let partToWrap: string;
  let post: string;
  let startIndex: number;

  // Try newer version pattern first
  // Pattern: overrideMessage:..., VAR=FUNC(EXPR),...key:"tokens"..., VAR," tokens"
  const m1 = oldFile.match(
    /(overrideMessage:.{0,10000},([$\w]+)=[$\w]+\()(.+?)(\),.{0,1000}key:"tokens".{0,200},\2," tokens")/
  );

  if (m1 && m1.index !== undefined) {
    [fullMatch, pre, , partToWrap, post] = m1;
    startIndex = m1.index;
  } else {
    const tokenLiteral = '" tokens"';
    let m2:
      | {
          fullMatch: string;
          pre: string;
          partToWrap: string;
          post: string;
          startIndex: number;
        }
      | undefined;

    let tokenIdx = -1;
    while ((tokenIdx = oldFile.indexOf(tokenLiteral, tokenIdx + 1)) !== -1) {
      const tokenUseSlice = oldFile.slice(
        Math.max(0, tokenIdx - 40),
        tokenIdx + tokenLiteral.length
      );
      const tokenUseMatch = tokenUseSlice.match(/([$\w]+)," tokens"$/);
      if (!tokenUseMatch) continue;

      const varName = tokenUseMatch[1];
      const searchStart = Math.max(0, tokenIdx - 1200);
      const searchSlice = oldFile.slice(
        searchStart,
        tokenIdx + tokenLiteral.length
      );
      if (!searchSlice.includes('key:"tokens"')) continue;

      const assignmentPattern = new RegExp(
        `,(${varName})=([\\$\\w]+)\\(([\\$\\w.]+)\\),`
      );
      const assignmentMatch = searchSlice.match(assignmentPattern);
      if (!assignmentMatch || assignmentMatch.index === undefined) continue;

      const assignmentStart = searchStart + assignmentMatch.index;
      const assignmentEnd = assignmentStart + assignmentMatch[0].length;
      const matchedText = oldFile.slice(assignmentStart, assignmentEnd);
      m2 = {
        fullMatch: matchedText,
        pre: `,${assignmentMatch[1]}=${assignmentMatch[2]}(`,
        partToWrap: assignmentMatch[3],
        post: '),',
        startIndex: assignmentStart,
      };
      break;
    }

    if (m2) {
      ({ fullMatch, pre, partToWrap, post, startIndex } = m2);
    } else {
      // Try oldest version pattern
      const m3 = oldFile.match(
        /(overrideMessage:.{0,10000},key:"tokens".{0,200}[$\w]+\()(Math\.round\(.+?\))(\))/
      );

      if (m3 && m3.index !== undefined) {
        [fullMatch, pre, partToWrap, post] = m3;
        startIndex = m3.index;
      } else {
        console.error(
          'patch: tokenCountRounding: cannot find token count pattern in any CC format'
        );
        return null;
      }
    }
  }

  const replacement = `${pre}Math.round((${partToWrap})/${roundingBase})*${roundingBase}${post}`;
  const endIndex = startIndex + fullMatch.length;

  const newFile =
    oldFile.slice(0, startIndex) + replacement + oldFile.slice(endIndex);

  showDiff(oldFile, newFile, replacement, startIndex, endIndex);

  return newFile;
};
