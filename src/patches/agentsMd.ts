// Please see the note about writing patches in ./index

import { showDiff } from './index';

/**
 * Patches the CLAUDE.md file reading function to also check for alternative
 * filenames (e.g., AGENTS.md) when CLAUDE.md doesn't exist.
 *
 * This finds the function that reads CLAUDE.md files and modifies it to:
 * 1. Add a `didReroute` parameter to the function
 * 2. At the early `return null` (when the file doesn't exist), check if the
 *    path ends with CLAUDE.md and try alternative names (unless didReroute
 *    is true)
 * 3. Recursive calls pass didReroute=true to avoid infinite loops
 *
 * CC 2.1.62 (approx. by Claude):
 * ```diff
 * -function _t7(A, q) {
 * +function _t7(A, q, didReroute) {
 *    try {
 *      let K = x1();
 * -    if (!K.existsSync(A) || !K.statSync(A).isFile()) return null;
 * +    if (!K.existsSync(A) || !K.statSync(A).isFile()) {
 * +      if (!didReroute && (A.endsWith("/CLAUDE.md") || A.endsWith("\\CLAUDE.md"))) {
 * +        for (let alt of ["AGENTS.md", "GEMINI.md", "QWEN.md"]) {
 * +          let altPath = A.slice(0, -9) + alt;
 * +          if (K.existsSync(altPath) && K.statSync(altPath).isFile())
 * +            return _t7(altPath, q, true);
 * +        }
 * +      }
 * +      return null;
 * +    }
 *      let Y = UL9(A).toLowerCase();
 *      if (Y && !dL9.has(Y))
 *        return (I(`Skipping non-text file in @include: ${A}`), null);
 *      let z = K.readFileSync(A, { encoding: "utf-8" }),
 *        { content: w, paths: H } = cL9(z);
 *      return { path: A, type: q, content: w, globs: H };
 *    } catch (K) {
 *      if (K instanceof Error && K.message.includes("EACCES"))
 *        n("tengu_claude_md_permission_error", {
 *          is_access_error: 1,
 *          has_home_dir: A.includes(_8()) ? 1 : 0,
 *        });
 *    }
 *    return null;
 *  }
 * ```
 */
export const writeAgentsMd = (
  file: string,
  altNames: string[]
): string | null => {
  if (file.includes('didReroute')) {
    return file;
  }

  // CC <2.1.87: sync function with readFileSync/existsSync/statSync
  const syncFuncPattern =
    /(function ([$\w]+)\(([$\w]+),([^)]+?))\)(?:.|\n){0,500}Skipping non-text file in @include/;
  // CC 2.1.87+: async function with readFile, delegates to sync parser
  const asyncFuncPattern =
    /(async function ([$\w]+)\(([$\w]+),([$\w]+),([$\w]+))\)\{try\{let [$\w]+=await ([$\w]+\(\))\.readFile\(\3,\{encoding:"utf-8"\}\);return ([$\w]+)\(/;

  const asyncMatch = file.match(asyncFuncPattern);
  const syncMatch = file.match(syncFuncPattern);

  // Try async path first (CC 2.1.87+ split fs ops into async wrapper)
  if (asyncMatch && asyncMatch.index !== undefined) {
    // Async path (CC 2.1.87+)
    // async function Fb8(H,$,q){try{let _=await O$().readFile(H,...);return ol4(_,H,$,q)}catch(K){return al4(K,H),{info:null,includePaths:[]}}}
    const functionName = asyncMatch[2];
    const firstParam = asyncMatch[3];
    const secondParam = asyncMatch[4];
    const thirdParam = asyncMatch[5];
    const fsExpr = asyncMatch[6]; // e.g., "O$()"
    const funcStart = asyncMatch.index;

    const altNamesJson = JSON.stringify(altNames);

    // Add didReroute parameter
    const sigIndex = funcStart + asyncMatch[1].length;
    let newFile =
      file.slice(0, sigIndex) + ',didReroute' + file.slice(sigIndex);

    showDiff(file, newFile, ',didReroute', sigIndex, sigIndex);

    // Find the catch block's ENOENT handling in al4 or inline
    // In 2.1.87: catch(K){return al4(K,H),{info:null,includePaths:[]}}
    // We inject the fallback before the catch's return
    const funcBody = newFile.slice(funcStart, funcStart + 500);
    const catchPattern = /catch\(([$\w]+)\)\{/;
    const catchMatch = funcBody.match(catchPattern);

    if (!catchMatch || catchMatch.index === undefined) {
      console.error(
        'patch: agentsMd: failed to find catch block in async function'
      );
      return null;
    }

    const catchBodyStart = funcStart + catchMatch.index + catchMatch[0].length;

    // Inject fallback: check if ENOENT/EISDIR and path ends with CLAUDE.md, try alternatives
    const catchVar = catchMatch[1];
    const fallback =
      `{let ec=typeof ${catchVar}==="object"&&${catchVar}!==null&&"code" in ${catchVar}?${catchVar}.code:null;` +
      `if((ec==="ENOENT"||ec==="EISDIR")&&!didReroute&&(${firstParam}.endsWith("/CLAUDE.md")||${firstParam}.endsWith("\\\\CLAUDE.md"))){` +
      `for(let alt of ${altNamesJson}){let altPath=${firstParam}.slice(0,-9)+alt;` +
      `try{await ${fsExpr}.readFile(altPath,{encoding:"utf-8"});` +
      `return ${functionName}(altPath,${secondParam},${thirdParam},true)}catch{}}}}`;

    newFile =
      newFile.slice(0, catchBodyStart) +
      fallback +
      newFile.slice(catchBodyStart);

    showDiff(file, newFile, fallback, catchBodyStart, catchBodyStart);

    return newFile;
  } else if (syncMatch && syncMatch.index !== undefined) {
    // Original sync path (CC <2.1.87)
    const upToFuncParamsClosingParen = syncMatch[1];
    const functionName = syncMatch[2];
    const firstParam = syncMatch[3];
    const restParams = syncMatch[4];
    const funcStart = syncMatch.index;

    const fsPattern = /([$\w]+(?:\(\))?)\.(?:readFileSync|existsSync|statSync)/;
    const fsMatch = syncMatch[0].match(fsPattern);
    if (!fsMatch) {
      console.error(
        'patch: agentsMd: failed to find fs expression in function'
      );
      return null;
    }
    const fsExpr = fsMatch[1];

    const altNamesJson = JSON.stringify(altNames);

    const sigIndex = funcStart + upToFuncParamsClosingParen.length;
    let newFile =
      file.slice(0, sigIndex) + ',didReroute' + file.slice(sigIndex);

    showDiff(file, newFile, ',didReroute', sigIndex, sigIndex);

    const funcBody = newFile.slice(funcStart);

    const oldEarlyReturnPattern = /\.isFile\(\)\)return null/;
    const newEarlyReturnPattern = /==="EISDIR"\)return null/;

    const earlyReturnMatch =
      funcBody.match(oldEarlyReturnPattern) ??
      funcBody.match(newEarlyReturnPattern);

    if (!earlyReturnMatch || earlyReturnMatch.index === undefined) {
      console.error(
        'patch: agentsMd: failed to find early return null for injection'
      );
      return null;
    }

    const isNewPattern = !funcBody.match(oldEarlyReturnPattern);

    const fallback = `if(!didReroute&&(${firstParam}.endsWith("/CLAUDE.md")||${firstParam}.endsWith("\\\\CLAUDE.md"))){for(let alt of ${altNamesJson}){let altPath=${firstParam}.slice(0,-9)+alt;if(${fsExpr}.existsSync(altPath)&&${fsExpr}.statSync(altPath).isFile())return ${functionName}(altPath,${restParams},true);}}`;

    const earlyReturnStart = funcStart + earlyReturnMatch.index;
    const oldStr = earlyReturnMatch[0];
    const newStr = isNewPattern
      ? `==="EISDIR"){${fallback}return null;}`
      : `.isFile()){${fallback}return null;}`;

    newFile =
      newFile.slice(0, earlyReturnStart) +
      newStr +
      newFile.slice(earlyReturnStart + oldStr.length);

    showDiff(file, newFile, newStr, earlyReturnStart, earlyReturnStart);

    return newFile;
  }

  console.error('patch: agentsMd: failed to find CLAUDE.md reading function');
  return null;
};
