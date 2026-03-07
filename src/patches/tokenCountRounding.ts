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
    // Try CC 2.1.71+ pattern: DH=Z6($H),...DH," tokens"
    // Token count is pre-computed into a variable, formatted by a function
    const m2 = oldFile.match(
      /,([$\w]+)=([$\w]+)\((.+?)\),.{0,500}\1," tokens"/
    );

    if (m2 && m2.index !== undefined) {
      // Wrap the expression inside the formatter call
      const varName = m2[1];
      const funcName = m2[2];
      partToWrap = m2[3];
      pre = `,${varName}=${funcName}(`;
      post = m2[0].slice(pre.length + partToWrap.length);
      fullMatch = m2[0];
      startIndex = m2.index;
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
