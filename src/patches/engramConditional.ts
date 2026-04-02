// Please see the note about writing patches in ./index

import { showDiff } from './index';

export const writeEngramConditional = (oldFile: string): string | null => {
  // Step 1: Find the u$ function (checkGate)
  const pattern =
    /function u\$\(H,\$\)\{let q=\$ZH\(\);if\(q&&H in q\)return q\[H\];let K=qZH\(\);if\(K&&H in K\)return K\[H\];if\(!tn\(\)\)return \$;/;
  const match = oldFile.match(pattern);

  if (!match || match.index === undefined) {
    console.error(
      'patch: engramConditional: failed to find u$ function definition'
    );
    return null;
  }

  const uFnName = 'u$';
  const gateNameVar = 'H';
  const defaultValVar = '$';

  // We want to insert our conditional check at the very beginning of the function
  const replacement =
    `function ${uFnName}(${gateNameVar},${defaultValVar}){` +
    `if(globalThis.__engramAvailable&&( ${gateNameVar}==="tengu_passport_quail"||${gateNameVar}==="tengu_moth_copse" ))return true;` +
    `if(globalThis.__engramAvailable===false&&( ${gateNameVar}==="tengu_passport_quail"||${gateNameVar}==="tengu_moth_copse" ))return false;` +
    match[0].slice(
      `function ${uFnName}(${gateNameVar},${defaultValVar}){`.length
    );

  const startIndex = match.index;
  const endIndex = startIndex + match[0].length;
  let newFile =
    oldFile.slice(0, startIndex) + replacement + oldFile.slice(endIndex);

  // Step 2: Inject the startup probe
  // We want to find a good place to start the probe.
  // Maybe near the start of the bundle or in an existing init function.
  // G_7 or similar.
  const probeCode = `(async()=>{try{let h=await fetch("https://engram.blissawry.com/mcp/",{method:"OPTIONS",timeout:2000});globalThis.__engramAvailable=h.ok}catch{globalThis.__engramAvailable=false}})();`;

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
