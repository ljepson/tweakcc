// Please see the note about writing patches in ./index

import { showDiff } from './index';

/**
 * Find all Clawd component function body start indices.
 *
 * Steps:
 * 1. Find ALL occurrences of '▛███▜' (the Clawd ASCII art header)
 * 2. For each occurrence:
 *    a. Get 2000 chars previous
 *    b. Find the LAST /function [$\w]+\(\)\{/ in that subsection
 *    c. Get the index after the `{`
 *    d. Add that to a list of indices
 * 3. Return all gotten indices
 */
const findStartupClawdComponents = (oldFile: string): number[] => {
  const indices: number[] = [];

  // Method 1 (CC <2.1.87): Clawd ASCII art is inline in function bodies
  const clawdPattern = /▛███▜|\\u259B\\u2588\\u2588\\u2588\\u259C/gi;

  let clawdMatch: RegExpExecArray | null;
  while ((clawdMatch = clawdPattern.exec(oldFile)) !== null) {
    const clawdIndex = clawdMatch.index;
    const lookbackStart = Math.max(0, clawdIndex - 2000);
    const beforeText = oldFile.slice(lookbackStart, clawdIndex);

    // Only match zero-arg functions (component renderers), not data objects
    const functionPattern = /function [$\w]+\(\)\{/g;
    let lastFunctionMatch: RegExpExecArray | null = null;
    let match: RegExpExecArray | null;

    while ((match = functionPattern.exec(beforeText)) !== null) {
      lastFunctionMatch = match;
    }

    if (lastFunctionMatch) {
      const absoluteIndex =
        lookbackStart + lastFunctionMatch.index + lastFunctionMatch[0].length;
      indices.push(absoluteIndex);
    }
    // If no function found, the art may be in a data object (CC 2.1.87+) — method 2 handles it
  }

  if (indices.length > 0) return indices;

  // Method 2 (CC 2.1.87+): Clawd art is in a data object, rendered by
  // functions that use color:"clawd_body". Find those rendering functions.
  const clawdBodyPattern =
    /function ([$\w]+)\([$\w]+\)\{.{0,500}color:"clawd_body"/g;
  const seen = new Set<string>();

  let bodyMatch: RegExpExecArray | null;
  while ((bodyMatch = clawdBodyPattern.exec(oldFile)) !== null) {
    const fnName = bodyMatch[1];
    if (seen.has(fnName)) continue;
    seen.add(fnName);

    // Find the opening brace of the function body
    const bodyStart = bodyMatch.index + bodyMatch[0].indexOf('{') + 1;
    indices.push(bodyStart);
  }

  // Also find the parent component that delegates to the clawd_body renderers
  // Pattern: function X(H){...DATA[...]...createElement(...{pose:...})...clawd_body
  const parentPattern =
    /function ([$\w]+)\([$\w]+\)\{.{0,400}[$\w]+\[\w+\]\[.{0,400}color:"clawd_body"/g;
  while ((bodyMatch = parentPattern.exec(oldFile)) !== null) {
    const fnName = bodyMatch[1];
    if (seen.has(fnName)) continue;
    seen.add(fnName);

    const bodyStart = bodyMatch.index + bodyMatch[0].indexOf('{') + 1;
    indices.push(bodyStart);
  }

  return indices;
};

export const writeHideStartupClawd = (oldFile: string): string | null => {
  const indices = findStartupClawdComponents(oldFile);

  if (indices.length === 0) {
    console.error('patch: hideStartupClawd: no Clawd components found');
    return null;
  }

  // Sort indices in REVERSE order so we can insert without affecting earlier positions
  const sortedIndices = [...indices].sort((a, b) => b - a);

  const insertCode = 'return null;';
  let newFile = oldFile;

  // Loop over indices in reverse order and insert `return null;` at each
  for (const index of sortedIndices) {
    newFile = newFile.slice(0, index) + insertCode + newFile.slice(index);
  }

  // Show diff for the first insertion (for debugging)
  if (sortedIndices.length > 0) {
    const lastIndex = sortedIndices[sortedIndices.length - 1]; // First in original order
    showDiff(oldFile, newFile, insertCode, lastIndex, lastIndex);
  }

  return newFile;
};
