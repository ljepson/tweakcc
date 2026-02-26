// Please see the note about writing patches in ./index

/**
 * Disables or customizes "anthropic-beta" headers in Claude Code.
 */
export const writeDisableBetaHeaders = (oldFile: string): string | null => {
  let content = oldFile;

  // 1. Target the dQ function which provides the central list of betas for message requests.
  // Minified version: function dQ(){return k$.sdkBetas}
  const dQPattern = /function dQ\(\)\{return\s+([$\w.]+)\.sdkBetas\}/;
  const dQMatch = content.match(dQPattern);
  if (dQMatch) {
    const kVar = dQMatch[1];
    // Comprehensive logic for dQ
    const newFunc = `function dQ(){let o=${kVar}.sdkBetas||[];if(process.env.CLAUDE_CODE_DISABLE_BETAS==="1"){o=o.filter(function(b){return b&&typeof b==="string"&&(b.indexOf("oauth")!==-1||b.indexOf("mcp-servers")!==-1)})}if(process.env.CLAUDE_CODE_ADD_BETAS){let a=process.env.CLAUDE_CODE_ADD_BETAS.split(",");for(let i=0;i<a.length;i++){let x=a[i].trim();if(x&&o.indexOf(x)===-1)o.push(x)}}return o}`;
    content = content.replace(dQPattern, newFunc);
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
