// Please see the note about writing patches in ./index

import { showDiff } from './index';

/**
 * Suppress AI attribution in git commit messages and PR descriptions.
 *
 * CC generates attribution via a function that returns {commit, pr} with:
 *   - commit: "Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
 *   - pr: "🤖 Generated with [Claude Code](...)"
 *
 * CC 2.1.92+:
 * ```diff
 * -;if(f.includeCoAuthoredBy===!1)return{commit:"",pr:""};return{commit:_,pr:K}
 * +;return{commit:"",pr:""}
 * ```
 */
export const writeSuppressGitAttribution = (file: string): string | null => {
  const pattern =
    /;if\([$\w]+\.includeCoAuthoredBy===!1\)return\{commit:"",pr:""\};return\{commit:[$\w]+,pr:[$\w]+\}/;

  const match = file.match(pattern);

  if (!match || match.index === undefined) {
    console.error('patch: suppressGitAttribution: failed to find pattern');
    return null;
  }

  const replacement = ';return{commit:"",pr:""}';
  const startIndex = match.index;
  const endIndex = startIndex + match[0].length;

  const newFile =
    file.slice(0, startIndex) + replacement + file.slice(endIndex);

  showDiff(file, newFile, replacement, startIndex, endIndex);
  return newFile;
};
