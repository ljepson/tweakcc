// Please see the note about writing patches in ./index

import { showDiff } from './index';

/**
 * Patches the CLAUDE.md file reading function to also check for alternative
 * filenames (e.g., AGENTS.md) when CLAUDE.md doesn't exist.
 *
 * CC <=2.1.62: Sync reader with existsSync/readFileSync in one function.
 * CC 2.1.63-2.1.75: Sync reader with try/catch ENOENT/EISDIR in one function.
 * CC 2.1.76+: Native didReroute support — patch is a no-op.
 * CC 2.1.86+: Async reader (UI6/readFile) with separate content processor (cl4).
 *   The funcPattern still matches cl4 for detecting native support,
 *   but injection targets the async reader's catch block instead.
 *
 * Async reader pattern (CC 2.1.86):
 * ```diff
 *  async function UI6(H,$,q){
 *    try{
 *      let _=await O8().readFile(H,{encoding:"utf-8"});
 *      return cl4(_,H,$,q)
 *    } catch(K) {
 * -    return ll4(K,H),{info:null,includePaths:[]}
 * +    let _ec=e6(K);
 * +    if((_ec==="ENOENT"||_ec==="EISDIR")&&(H.endsWith("/CLAUDE.md")||H.endsWith("\\CLAUDE.md"))){
 * +      let _fs=O8();
 * +      for(let alt of ["AGENTS.md"]){
 * +        let altPath=H.slice(0,-9)+alt;
 * +        try{let _c=await _fs.readFile(altPath,{encoding:"utf-8"});return cl4(_c,altPath,$,q)}catch{}
 * +      }
 * +    }
 * +    return ll4(K,H),{info:null,includePaths:[]}
 *    }
 *  }
 * ```
 */
export const writeAgentsMd = (
  file: string,
  altNames: string[]
): string | null => {
  // Check for native didReroute support (CC 2.1.76+) by finding the content processor
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

  const contentProcessorName = funcMatch[2];

  // Detect whether this version uses the sync or async reader pattern.
  // Sync pattern: the matched function itself contains readFileSync/existsSync.
  // Async pattern: a separate async function reads the file and calls the content processor.
  const fsPattern = /([$\w]+(?:\(\))?)\.(?:readFileSync|existsSync|statSync)/;
  const fsMatch = funcMatch[0].match(fsPattern);

  if (fsMatch) {
    // ====================================================================
    // Sync reader (CC <=2.1.75) — original injection approach
    // ====================================================================
    return applySyncPatch(file, funcMatch, fsMatch[1], altNames);
  }

  // ====================================================================
  // Async reader (CC 2.1.86+) — inject into the async reader's catch block
  // ====================================================================
  return applyAsyncPatch(file, contentProcessorName, altNames);
};

/**
 * Apply patch for sync reader (CC <=2.1.75)
 */
function applySyncPatch(
  file: string,
  funcMatch: RegExpMatchArray,
  fsExpr: string,
  altNames: string[]
): string | null {
  const upToFuncParamsClosingParen = funcMatch[1];
  const functionName = funcMatch[2];
  const firstParam = funcMatch[3];
  const restParams = funcMatch[4];
  const funcStart = funcMatch.index!;

  const altNamesJson = JSON.stringify(altNames);

  // Step 1: Add didReroute parameter to function signature
  const sigIndex = funcStart + upToFuncParamsClosingParen.length;
  let newFile = file.slice(0, sigIndex) + ',didReroute' + file.slice(sigIndex);

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
    const newStr = oldStr.replace(')return null', `){${fallback}return null;}`);

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

/**
 * Apply patch for async reader (CC 2.1.86+)
 *
 * Finds the async function that calls readFile and the content processor,
 * then injects fallback logic in its catch block.
 */
function applyAsyncPatch(
  file: string,
  contentProcessorName: string,
  altNames: string[]
): string | null {
  // Find the async reader function:
  // async function NAME(PATH,TYPE,Q){try{let _=await FS.readFile(PATH,...);return PROCESSOR(_,PATH,TYPE,Q)}catch(ERR){return ERR_HANDLER(ERR,PATH),{info:null,includePaths:[]}}}
  const asyncReaderPattern = new RegExp(
    `async function ([$\\w]+)\\(([$\\w]+),([$\\w]+)(?:,([$\\w]+))?\\)\\{try\\{let ([$\\w]+)=await ([$\\w]+\\(\\))\\.readFile\\(\\2,\\{encoding:"utf-8"\\}\\);return ${contentProcessorName.replace(/\$/g, '\\$')}\\(\\5,\\2,\\3(?:,\\4)?\\)\\}catch\\(([$\\w]+)\\)\\{return ([$\\w]+)\\(\\7,\\2\\),\\{info:null,includePaths:\\[\\]\\}\\}\\}`
  );

  const asyncMatch = file.match(asyncReaderPattern);
  if (!asyncMatch || asyncMatch.index === undefined) {
    console.error('patch: agentsMd: failed to find async reader function');
    return null;
  }

  const pathParam = asyncMatch[2];
  const typeParam = asyncMatch[3];
  const extraParam = asyncMatch[4] || '';
  const fsExpr = asyncMatch[6];
  const errParam = asyncMatch[7];
  const errHandler = asyncMatch[8];

  // Find the error code getter function used in the error handler
  // ll4 uses: let q=ERROR_CODE_FN(H);if(q==="ENOENT"...
  const errHandlerDef = file.match(
    new RegExp(
      `function ${errHandler.replace(/\$/g, '\\$')}\\([$\\w]+,[$\\w]+\\)\\{let [$\\w]+=([$\\w]+)\\([$\\w]+\\);if\\([$\\w]+===?"ENOENT"`
    )
  );
  const errCodeFn = errHandlerDef ? errHandlerDef[1] : null;

  const altNamesJson = JSON.stringify(altNames);
  const extraParamArg = extraParam ? `,${extraParam}` : '';

  // Build the fallback code that goes before the return in the catch block
  let errCodeExpr: string;
  if (errCodeFn) {
    errCodeExpr = `${errCodeFn}(${errParam})`;
  } else {
    // Fallback: use .code directly
    errCodeExpr = `${errParam}.code`;
  }

  const fallback = `let _ec=${errCodeExpr};if((_ec==="ENOENT"||_ec==="EISDIR")&&(${pathParam}.endsWith("/CLAUDE.md")||${pathParam}.endsWith("\\\\CLAUDE.md"))){let _fs=${fsExpr};for(let alt of ${altNamesJson}){let altPath=${pathParam}.slice(0,-9)+alt;try{let _c=await _fs.readFile(altPath,{encoding:"utf-8"});return ${contentProcessorName}(_c,altPath,${typeParam}${extraParamArg})}catch{}}}`;

  // Replace the catch block: inject fallback before the return
  const catchStr = `catch(${errParam}){return ${errHandler}(${errParam},${pathParam}),{info:null,includePaths:[]}}`;
  const newCatchStr = `catch(${errParam}){${fallback}return ${errHandler}(${errParam},${pathParam}),{info:null,includePaths:[]}}`;

  const catchIdx = file.indexOf(catchStr, asyncMatch.index);
  if (catchIdx === -1) {
    console.error(
      'patch: agentsMd: failed to find catch block in async reader'
    );
    return null;
  }

  const newFile =
    file.slice(0, catchIdx) +
    newCatchStr +
    file.slice(catchIdx + catchStr.length);

  showDiff(file, newFile, newCatchStr, catchIdx, catchIdx + catchStr.length);

  return newFile;
}
