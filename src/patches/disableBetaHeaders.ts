// Please see the note about writing patches in ./index

/**
 * Disables or customizes "anthropic-beta" headers in Claude Code.
 */
export const writeDisableBetaHeaders = (oldFile: string): string | null => {
  let content = oldFile;

  // 1. Target the sdkBetas getter function (e.g. function dQ(){return k$.sdkBetas}
  // or function kX(){return S$.sdkBetas}). The function name changes across versions.
  const betaGetterPattern =
    /function ([$\w]+)\(\)\{return\s+([$\w.]+)\.sdkBetas\}/;
  const betaGetterMatch = content.match(betaGetterPattern);
  if (betaGetterMatch) {
    const fnName = betaGetterMatch[1];
    const stateVar = betaGetterMatch[2];
    const newFunc = `function ${fnName}(){let o=${stateVar}.sdkBetas||[];if(process.env.CLAUDE_CODE_DISABLE_BETAS==="1"){o=o.filter(function(b){return b&&typeof b==="string"&&(b.indexOf("oauth")!==-1||b.indexOf("mcp-servers")!==-1)})}if(process.env.CLAUDE_CODE_ADD_BETAS){let a=process.env.CLAUDE_CODE_ADD_BETAS.split(",");for(let i=0;i<a.length;i++){let x=a[i].trim();if(x&&o.indexOf(x)===-1)o.push(x)}}return o}`;
    content = content.replace(betaGetterPattern, newFunc);
  }

  // 2. Target "anthropic-beta" as a key in object literals (headers)
  // We use a safe computed property name.
  content = content.replace(
    /"anthropic-beta":/g,
    '[process.env.CLAUDE_CODE_DISABLE_BETAS==="1"?"x-disabled-beta":"anthropic-beta"]:'
  );

  if (content === oldFile) {
    if (oldFile.includes('CLAUDE_CODE_DISABLE_BETAS')) {
      return oldFile;
    }
    return null;
  }

  return content;
};
