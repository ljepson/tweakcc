// Please see the note about writing patches in ./index

/**
 * Disables or customizes "anthropic-beta" headers in Claude Code.
 *
 * CC assembles betas from two sources:
 *   1. A memoized per-model builder (hardcodes betas like claude-code-*, interleaved-thinking, etc.)
 *   2. The sdkBetas getter (returns state.sdkBetas array)
 * These merge in a function identified by the stable string "isAgenticQuery".
 *
 * We patch that merge function to filter/augment the final merged array,
 * and we also patch the sdkBetas getter as a fallback for older versions.
 */
export const writeDisableBetaHeaders = (oldFile: string): string | null => {
  let content = oldFile;

  // 1. Patch the merge function (contains "isAgenticQuery") to filter the
  // final beta array. This catches betas from ALL sources.
  // Pattern: return[...A,...L.filter((I)=>!A.includes(I))]}
  // after the isAgenticQuery block.
  const mergeReturnPattern =
    /(\bisAgenticQuery\b[^}]*\})(let\s+([$\w]+)=([$\w]+)\(\);if\(!\3\|\|\3\.length===0\)return\s+([$\w]+);return\[\.\.\.(\5),\.\.\.\3\.filter\(\(([$\w]+)\)=>!\5\.includes\(\7\)\)\])\}/;
  const mergeMatch = content.match(mergeReturnPattern);
  if (mergeMatch) {
    const resultVar = mergeMatch[5];
    const sdkVar = mergeMatch[3];
    const sdkGetter = mergeMatch[4];
    const elemVar = mergeMatch[7];
    const originalBlock = mergeMatch[2];
    const newBlock =
      `let ${sdkVar}=${sdkGetter}();` +
      `let _r;` +
      `if(!${sdkVar}||${sdkVar}.length===0)_r=${resultVar};` +
      `else _r=[...${resultVar},...${sdkVar}.filter((${elemVar})=>!${resultVar}.includes(${elemVar}))];` +
      `if(process.env.CLAUDE_CODE_DISABLE_BETAS==="1"){` +
      `_r=_r.filter(function(b){return b&&typeof b==="string"&&b.indexOf("oauth")!==-1})` +
      `}` +
      `if(process.env.CLAUDE_CODE_ADD_BETAS){` +
      `let a=process.env.CLAUDE_CODE_ADD_BETAS.split(",");` +
      `for(let i=0;i<a.length;i++){let x=a[i].trim();if(x&&_r.indexOf(x)===-1)_r.push(x)}` +
      `}` +
      `return _r}`;
    content = content.replace(originalBlock + '}', newBlock);
  }

  // 2. Also patch the sdkBetas getter as a fallback (older CC versions
  // that don't have the merge function, or if the merge pattern changes).
  const betaGetterPattern =
    /function ([$\w]+)\(\)\{return\s+([$\w.]+)\.sdkBetas\}/;
  const betaGetterMatch = content.match(betaGetterPattern);
  if (betaGetterMatch) {
    const fnName = betaGetterMatch[1];
    const stateVar = betaGetterMatch[2];
    const newFunc =
      `function ${fnName}(){` +
      `let o=${stateVar}.sdkBetas||[];` +
      `if(process.env.CLAUDE_CODE_DISABLE_BETAS==="1"){` +
      `o=o.filter(function(b){return b&&typeof b==="string"&&b.indexOf("oauth")!==-1})` +
      `}` +
      `if(process.env.CLAUDE_CODE_ADD_BETAS){` +
      `let a=process.env.CLAUDE_CODE_ADD_BETAS.split(",");` +
      `for(let i=0;i<a.length;i++){let x=a[i].trim();if(x&&o.indexOf(x)===-1)o.push(x)}` +
      `}` +
      `return o}`;
    content = content.replace(betaGetterPattern, newFunc);
  }

  if (content === oldFile) {
    if (oldFile.includes('CLAUDE_CODE_DISABLE_BETAS')) {
      return oldFile;
    }
    return null;
  }

  return content;
};
