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

  const altNamesJson = JSON.stringify(altNames);

  if (fsMatch) {
    // Sync path (CC <=2.1.82): fs calls are inside the matched function itself
    const fsExpr = fsMatch[1];

    // Step 1: Add didReroute parameter to function signature
    const sigIndex = funcStart + upToFuncParamsClosingParen.length;
    let newFile =
      file.slice(0, sigIndex) + ',didReroute' + file.slice(sigIndex);

    showDiff(file, newFile, ',didReroute', sigIndex, sigIndex);

    // Step 2: Inject fallback logic
    const funcBody = newFile.slice(funcStart);

    const enoentPattern = /===?"ENOENT"\|\|[$\w.]+===?"EISDIR"\)return null/;
    const enoentMatch = funcBody.match(enoentPattern);

    const oldEarlyReturnPattern = /\.isFile\(\)\)return null/;
    const newEarlyReturnPattern = /==="EISDIR"\)return null/;
    const earlyReturnMatch =
      funcBody.match(oldEarlyReturnPattern) ??
      funcBody.match(newEarlyReturnPattern);

    if (enoentMatch && enoentMatch.index !== undefined) {
      const fallback = `if(!didReroute&&(${firstParam}.endsWith("/CLAUDE.md")||${firstParam}.endsWith("\\\\CLAUDE.md"))){let _fs=${fsExpr};for(let alt of ${altNamesJson}){let altPath=${firstParam}.slice(0,-9)+alt;if(_fs.existsSync(altPath)&&_fs.statSync(altPath).isFile())return ${functionName}(altPath,${restParams},true);}}`;

      const matchStart = funcStart + enoentMatch.index;
      const oldStr = enoentMatch[0];
      const newStr = oldStr.replace(
        ')return null',
        `){${fallback}return null;}`
      );

      newFile =
        newFile.slice(0, matchStart) +
        newStr +
        newFile.slice(matchStart + oldStr.length);

      showDiff(file, newFile, newStr, matchStart, matchStart);
    } else if (earlyReturnMatch && earlyReturnMatch.index !== undefined) {
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
  }

  // Async path (CC 2.1.83+): file reading moved to a separate async wrapper
  // function that calls the content-processing function (functionName).
  // Pattern: async function WRAPPER(P1,P2,P3){try{let X=await FSEXPR.readFile(P1,...);return FUNCNAME(X,P1,P2,P3)}catch(E){return ERRHANDLER(E,P1),{info:null,includePaths:[]}}}
  const escapedFuncName = functionName.replace(/\$/g, '\\$');
  const asyncReaderPattern = new RegExp(
    `(async function ([$\\w]+)\\(([$\\w]+),([$\\w]+),([$\\w]+)\\))\\{try\\{let ([$\\w]+)=await ([$\\w]+(?:\\(\\))?\\.readFile)\\(\\3,\\{encoding:"utf-8"\\}\\);return ${escapedFuncName}\\(\\6,\\3,\\4,\\5\\)\\}catch\\(([$\\w]+)\\)\\{return ([$\\w]+)\\(\\8,\\3\\),\\{info:null,includePaths:\\[\\]\\}\\}\\}`
  );
  const asyncMatch = file.match(asyncReaderPattern);
  if (!asyncMatch || asyncMatch.index === undefined) {
    console.error('patch: agentsMd: failed to find fs expression in function');
    return null;
  }

  const asyncFuncSig = asyncMatch[1];
  const asyncFuncName = asyncMatch[2];
  const asyncP1 = asyncMatch[3]; // file path param
  const asyncP2 = asyncMatch[4];
  const asyncP3 = asyncMatch[5];
  const asyncErrVar = asyncMatch[8];
  const asyncErrHandler = asyncMatch[9];
  const asyncStart = asyncMatch.index;

  // Step 1: Add didReroute parameter
  const asyncSigEnd = asyncStart + asyncFuncSig.length;
  let newFile =
    file.slice(0, asyncSigEnd) + ',didReroute' + file.slice(asyncSigEnd);

  showDiff(file, newFile, ',didReroute', asyncSigEnd, asyncSigEnd);

  // Step 2: Replace the catch block with one that tries alt filenames
  // Original: catch(E){return HANDLER(E,P1),{info:null,includePaths:[]}}
  // New: catch(E){if(!didReroute&&E.code==="ENOENT"&&(P1.endsWith(...))){ try alts... } return HANDLER(E,P1),{info:null,includePaths:[]}}
  const fallback = `if(!didReroute&&${asyncErrVar}.code==="ENOENT"&&(${asyncP1}.endsWith("/CLAUDE.md")||${asyncP1}.endsWith("\\\\CLAUDE.md"))){for(let alt of ${altNamesJson}){try{let _r=await ${asyncFuncName}(${asyncP1}.slice(0,-9)+alt,${asyncP2},${asyncP3},true);if(_r.info!==null)return _r;}catch(_e){}}}`;

  const oldCatch = `catch(${asyncErrVar}){return ${asyncErrHandler}(${asyncErrVar},${asyncP1}),{info:null,includePaths:[]}}`;
  const newCatch = `catch(${asyncErrVar}){${fallback}return ${asyncErrHandler}(${asyncErrVar},${asyncP1}),{info:null,includePaths:[]}}`;

  // The catch block is in the already-modified file (with didReroute added)
  newFile = newFile.replace(oldCatch, newCatch);

  if (!newFile.includes(fallback)) {
    console.error(
      'patch: agentsMd: failed to inject fallback into async catch block'
    );
    return null;
  }

  showDiff(file, newFile, newCatch, asyncStart, asyncStart);

  return newFile;
};
