// Please see the note about writing patches in ./index

import { showDiff } from './index';

export const writeEngramConditional = (oldFile: string): string | null => {
  if (
    oldFile.includes('globalThis.__engramAvailable') &&
    oldFile.includes('H==="tengu_passport_quail"||H==="tengu_moth_copse"')
  ) {
    return oldFile;
  }

  // Step 1: Find the feature gate helper and insert our conditional check
  // immediately after the function opening brace.
  const pattern =
    /function u\$\(([$\w]+),([$\w]+)\)\{let ([$\w]+)=\$ZH\(\);if\(\3&&\1 in \3\)return \3\[\1\];let ([$\w]+)=qZH\(\);if\(\4&&\1 in \4\)return \4\[\1\];if\(!tn\(\)\)return \2;/;
  const match = oldFile.match(pattern);

  if (!match || match.index === undefined) {
    console.error(
      'patch: engramConditional: failed to find u$ function definition'
    );
    return null;
  }

  const uFnName = 'u$';
  const gateNameVar = match[1];
  const defaultValVar = match[2];

  // We want to insert our conditional check at the very beginning of the function
  const replacement =
    `function ${uFnName}(${gateNameVar},${defaultValVar}){` +
    `if(globalThis.__engramAvailable&&(${gateNameVar}==="tengu_passport_quail"||${gateNameVar}==="tengu_moth_copse"))return true;` +
    `if(globalThis.__engramAvailable===false&&(${gateNameVar}==="tengu_passport_quail"||${gateNameVar}==="tengu_moth_copse"))return false;` +
    match[0].slice(
      `function ${uFnName}(${gateNameVar},${defaultValVar}){`.length
    );

  const startIndex = match.index;
  const endIndex = startIndex + match[0].length;
  let newFile =
    oldFile.slice(0, startIndex) + replacement + oldFile.slice(endIndex);

  // Step 2: Inject the startup probe
  // Initialize to false (fail-closed) so features are disabled until probe succeeds.
  // This prevents race conditions where feature gates check before the async probe completes.
  const probeCode = `globalThis.__engramAvailable=false;(async()=>{try{let h=await fetch("https://engram.blissawry.com/mcp/",{method:"OPTIONS"});if(h.ok)globalThis.__engramAvailable=true}catch{}})();`;

  // We will just prepend it to the whole file
  newFile = probeCode + '\n' + newFile;

  showDiff(
    oldFile,
    newFile,
    'Engram Conditional Detection',
    startIndex,
    endIndex
  );
  return newFile;
};
