// Please see the note about writing patches in ./index

import { globalReplace } from './index';

/**
 * Disables "anthropic-beta" headers in Claude Code.
 *
 * It targets several patterns:
 * 1. betas: [...] -> Replace with empty array if CC_DISABLE_BETAS is set
 * 2. "anthropic-beta": -> Replace with computed property if CC_DISABLE_BETAS is set
 * 3. ["anthropic-beta"] -> Replace with computed property if CC_DISABLE_BETAS is set
 * 4. Specific beta strings like "oauth-2025-04-20"
 */
export const writeDisableBetaHeaders = (oldFile: string): string | null => {
  // Pattern 1: betas:[...] or betas: [...]
  // We replace it to respect an environment variable CC_DISABLE_BETAS.
  // If the env var is set, we return an empty array, effectively disabling the headers.
  let content = globalReplace(
    oldFile,
    /betas:\s*\[/g,
    'betas:process.env.CC_DISABLE_BETAS?[]:['
  );

  // Pattern 2: "anthropic-beta" as a key in an object literal: {"anthropic-beta": ...}
  // We convert it to a computed property: {[process.env.CC_DISABLE_BETAS?"data-disabled-beta":"anthropic-beta"]: ...}
  // This is safe for object literals and preserves syntax.
  content = globalReplace(
    content,
    /"anthropic-beta":/g,
    '[process.env.CC_DISABLE_BETAS?"data-disabled-beta":"anthropic-beta"]:'
  );

  // Pattern 3: "anthropic-beta" as a property access key: obj["anthropic-beta"]
  // We convert it to: obj[process.env.CC_DISABLE_BETAS?"data-disabled-beta":"anthropic-beta"]
  content = globalReplace(
    content,
    /\["anthropic-beta"\]/g,
    '[process.env.CC_DISABLE_BETAS?"data-disabled-beta":"anthropic-beta"]'
  );

  // Pattern 4: Specific beta header strings.
  // If the string itself is hardcoded and used in a way that Pattern 1/2/3 missed.
  content = globalReplace(
    content,
    /"oauth-2025-04-20"/g,
    'process.env.CC_DISABLE_BETAS?"disabled":"oauth-2025-04-20"'
  );

  return content;
};
