import { showDiff } from './index';

export const writeSkipTrustDialog = (file: string): string | null => {
  // Match the trust-check function that decides whether to show the
  // "Accessing workspace" dialog at startup. The function checks
  // hasTrustDialogAccepted for the current directory and parents,
  // returning false if none are trusted.
  //
  // Patch: replace the function body with `return!0` so it always
  // returns true, skipping the trust dialog entirely.

  const anchor = 'hasTrustDialogAccepted)return!0;';
  const anchorIdx = file.indexOf(anchor);
  if (anchorIdx === -1) {
    console.error(
      'patch: skipTrustDialog: failed to find hasTrustDialogAccepted anchor'
    );
    return null;
  }

  // Walk backwards from anchor to find the nearest `function XXX(){`
  // The function starts within ~100 chars before the first anchor.
  // Use progressively larger windows to handle different CC versions.
  let fnMatch: RegExpMatchArray | null = null;
  let chunkStart = 0;

  for (const lookback of [100, 200, 400]) {
    chunkStart = Math.max(0, anchorIdx - lookback);
    const chunk = file.substring(chunkStart, anchorIdx);
    // Match the LAST function declaration in the chunk (closest to anchor)
    const matches = [...chunk.matchAll(/function ([$\w]+)\(\)\{/g)];
    if (matches.length > 0) {
      fnMatch = matches[matches.length - 1];
      break;
    }
  }

  if (!fnMatch || fnMatch.index === undefined) {
    console.error('patch: skipTrustDialog: failed to find enclosing function');
    return null;
  }

  const fnStart = chunkStart + fnMatch.index;
  const bodyStart = fnStart + fnMatch[0].indexOf('{');

  // Walk forward from bodyStart counting braces to find the closing }
  let depth = 0;
  let fnEnd = bodyStart;
  for (let i = bodyStart; i < file.length && i < bodyStart + 500; i++) {
    if (file[i] === '{') depth++;
    if (file[i] === '}') {
      depth--;
      if (depth === 0) {
        fnEnd = i + 1;
        break;
      }
    }
  }

  if (depth !== 0) {
    console.error('patch: skipTrustDialog: failed to find closing brace');
    return null;
  }

  const fnBody = file.substring(fnStart, fnEnd);
  if (!fnBody.endsWith('return!1}')) {
    console.error(
      'patch: skipTrustDialog: function does not end with return!1}'
    );
    return null;
  }

  const fnHeader = `function ${fnMatch[1]}(){`;
  const replacement = fnHeader + 'return!0}';

  const newFile = file.slice(0, fnStart) + replacement + file.slice(fnEnd);

  showDiff(file, newFile, replacement, fnStart, fnEnd);

  return newFile;
};
