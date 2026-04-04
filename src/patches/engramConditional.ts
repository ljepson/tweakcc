// Please see the note about writing patches in ./index

import { showDiff } from './index';

export const writeEngramConditional = (oldFile: string): string | null => {
  if (
    oldFile.includes('globalThis.__engramAvailable') &&
    oldFile.includes('"tengu_passport_quail"') &&
    oldFile.includes('"tengu_moth_copse"')
  ) {
    return oldFile;
  }

  // Step 1: Find the feature gate helper and insert our conditional check
  // immediately after the function opening brace.
  // The function name and internal identifiers change across minified versions,
  // but the structure is stable: 2-param function that checks two override
  // sources then falls back through a guard function.
  const pattern =
    /function ([$\w]+)\(([$\w]+),([$\w]+)\)\{let ([$\w]+)=([$\w]+)\(\);if\(\4&&\2 in \4\)return \4\[\2\];let ([$\w]+)=([$\w]+)\(\);if\(\6&&\2 in \6\)return \6\[\2\];if\(!([$\w]+)\(\)\)return \3;/;
  const match = oldFile.match(pattern);

  if (!match || match.index === undefined) {
    console.error(
      'patch: engramConditional: failed to find feature gate function definition'
    );
    return null;
  }

  const fnName = match[1];
  const gateNameVar = match[2];
  const defaultValVar = match[3];

  // We want to insert our conditional check at the very beginning of the function
  const replacement =
    `function ${fnName}(${gateNameVar},${defaultValVar}){` +
    `if(globalThis.__engramAvailable&&(${gateNameVar}==="tengu_passport_quail"||${gateNameVar}==="tengu_moth_copse"))return true;` +
    `if(globalThis.__engramAvailable===false&&(${gateNameVar}==="tengu_passport_quail"||${gateNameVar}==="tengu_moth_copse"))return false;` +
    match[0].slice(
      `function ${fnName}(${gateNameVar},${defaultValVar}){`.length
    );

  const startIndex = match.index;
  const endIndex = startIndex + match[0].length;
  let newFile =
    oldFile.slice(0, startIndex) + replacement + oldFile.slice(endIndex);

  // Step 2: Inject the startup probe
  // Initialize to false (fail-closed) so features are disabled until probe succeeds.
  // This prevents race conditions where feature gates check before the async probe completes.
  const probeCode = `globalThis.__engramAvailable=false;(async()=>{try{let h=await fetch("https://engram.blissawry.com/mcp/",{method:"OPTIONS"});if(h.ok)globalThis.__engramAvailable=true}catch{}})();`;

  // Inject after Bun CJS wrapper, not before header
  const BUN_CJS_MARKER =
    '(function(exports, require, module, __filename, __dirname) {';
  const markerIdx = newFile.indexOf(BUN_CJS_MARKER);
  if (markerIdx !== -1) {
    const insertPoint = markerIdx + BUN_CJS_MARKER.length;
    newFile =
      newFile.slice(0, insertPoint) +
      '\n' +
      probeCode +
      newFile.slice(insertPoint);
  } else {
    // Non-Bun bundle: prepend
    newFile = probeCode + '\n' + newFile;
  }

  showDiff(
    oldFile,
    newFile,
    'Engram Conditional Detection',
    startIndex,
    endIndex
  );
  return newFile;
};
