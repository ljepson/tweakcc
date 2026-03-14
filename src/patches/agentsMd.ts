// Please see the note about writing patches in ./index

import { showDiff } from './index';

/**
 * Patches the CLAUDE.md file reading function to also check for alternative
 * filenames (e.g., AGENTS.md) when CLAUDE.md doesn't exist.
 *
 * This finds the function that reads CLAUDE.md files and modifies it to:
 * 1. Add a `didReroute` parameter to the function
 * 2. In the catch block where ENOENT/EISDIR returns null, inject fallback
 *    logic to try alternative filenames (unless didReroute is true)
 * 3. Recursive calls pass didReroute=true to avoid infinite loops
 *
 * CC <=2.1.62 had an explicit existsSync/isFile check before readFileSync.
 * CC >=2.1.63 removed that check and relies on try/catch with error codes:
 *
 * ```diff
 * -function c_A(H,$) {
 * +function c_A(H,$,didReroute) {
 *    try {
 *      let L = L$().readFileSync(H, {encoding:"utf-8"}),
 *          I = DM.extname(H).toLowerCase();
 *      ...
 *      return { path: H, type: $, content: f, globs: B };
 *    } catch(A) {
 *      let L = A.code;
 * -    if (L==="ENOENT" || L==="EISDIR") return null;
 * +    if (L==="ENOENT" || L==="EISDIR") {
 * +      if (!didReroute && (H.endsWith("/CLAUDE.md") || H.endsWith("\\CLAUDE.md"))) {
 * +        let _fs = L$();
 * +        for (let alt of ["AGENTS.md","GEMINI.md","QWEN.md"]) {
 * +          let altPath = H.slice(0,-9) + alt;
 * +          if (_fs.existsSync(altPath) && _fs.statSync(altPath).isFile())
 * +            return c_A(altPath, $, true);
 * +        }
 * +      }
 * +      return null;
 * +    }
 *      if (L==="EACCES")
 *        c("tengu_claude_md_permission_error", {...});
 *    }
 *    return null;
 *  }
 * ```
 */
export const writeAgentsMd = (
  file: string,
  altNames: string[]
): string | null => {
  const funcPattern =
    /(function ([$\w]+)\(([$\w]+),([^)]+?))\)(?:.|\n){0,500}Skipping non-text file in @include/;

  const funcMatch = file.match(funcPattern);
  if (!funcMatch || funcMatch.index === undefined) {
    console.error('patch: agentsMd: failed to find CLAUDE.md reading function');
    return null;
  }

  // CC 2.1.76+ natively includes didReroute and AGENTS.md rerouting
  if (funcMatch[0].includes('didReroute')) {
    return file;
  }
  const upToFuncParamsClosingParen = funcMatch[1];
  const functionName = funcMatch[2];
  const firstParam = funcMatch[3];
  const restParams = funcMatch[4];
  const funcStart = funcMatch.index;

  const fsPattern = /([$\w]+(?:\(\))?)\.(?:readFileSync|existsSync|statSync)/;
  const fsMatch = funcMatch[0].match(fsPattern);
  if (!fsMatch) {
    console.error('patch: agentsMd: failed to find fs expression in function');
    return null;
  }
  const fsExpr = fsMatch[1];

  const altNamesJson = JSON.stringify(altNames);

  // Step 1: Add didReroute parameter to function signature
  const sigIndex = funcStart + upToFuncParamsClosingParen.length;
  let newFile = file.slice(0, sigIndex) + ',didReroute' + file.slice(sigIndex);

  showDiff(file, newFile, ',didReroute', sigIndex, sigIndex);

  // Step 2: Inject fallback logic
  // Try new style first (CC >=2.1.63): ENOENT/EISDIR catch block
  // Fall back to old style (CC <=2.1.62): early existsSync/isFile return null
  const funcBody = newFile.slice(funcStart);

  const enoentPattern = /===?"ENOENT"\|\|[$\w.]+===?"EISDIR"\)return null/;
  const enoentMatch = funcBody.match(enoentPattern);

  // CC ≤2.1.62: existsSync/isFile check before reading
  const oldEarlyReturnPattern = /\.isFile\(\)\)return null/;
  // CC ≥2.1.69: try/catch with ENOENT/EISDIR error codes
  const newEarlyReturnPattern = /==="EISDIR"\)return null/;

  const earlyReturnMatch =
    funcBody.match(oldEarlyReturnPattern) ??
    funcBody.match(newEarlyReturnPattern);

  if (enoentMatch && enoentMatch.index !== undefined) {
    // New style: inject at ENOENT/EISDIR return null in catch block
    const fallback = `if(!didReroute&&(${firstParam}.endsWith("/CLAUDE.md")||${firstParam}.endsWith("\\\\CLAUDE.md"))){let _fs=${fsExpr};for(let alt of ${altNamesJson}){let altPath=${firstParam}.slice(0,-9)+alt;if(_fs.existsSync(altPath)&&_fs.statSync(altPath).isFile())return ${functionName}(altPath,${restParams},true);}}`;

    const matchStart = funcStart + enoentMatch.index;
    const oldStr = enoentMatch[0];
    const newStr = oldStr.replace(')return null', `){${fallback}return null;}`);

    newFile =
      newFile.slice(0, matchStart) +
      newStr +
      newFile.slice(matchStart + oldStr.length);

    showDiff(file, newFile, newStr, matchStart, matchStart);
  } else if (earlyReturnMatch && earlyReturnMatch.index !== undefined) {
    // Old style: inject at existsSync/isFile early return null
    const fallback = `if(!didReroute&&(${firstParam}.endsWith("/CLAUDE.md")||${firstParam}.endsWith("\\\\CLAUDE.md"))){for(let alt of ${altNamesJson}){let altPath=${firstParam}.slice(0,-9)+alt;if(${fsExpr}.existsSync(altPath)&&${fsExpr}.statSync(altPath).isFile())return ${functionName}(altPath,${restParams},true);}}`;

    const earlyReturnStart = funcStart + earlyReturnMatch.index;
    const oldStr = earlyReturnMatch[0];
    const newStr = `.isFile()){${fallback}return null;}`;

    newFile =
      newFile.slice(0, earlyReturnStart) +
      newStr +
      newFile.slice(earlyReturnStart + oldStr.length);

    showDiff(file, newFile, newStr, earlyReturnStart, earlyReturnStart);
  } else {
    console.error(
      'patch: agentsMd: failed to find injection point (no ENOENT catch or early return null)'
    );
    return null;
  }

  return newFile;
};
