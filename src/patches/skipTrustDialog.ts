import { showDiff } from './index';

export const writeSkipTrustDialog = (file: string): string | null => {
  // Match the trust-check function that decides whether to show the
  // "Accessing workspace" dialog at startup.
  //
  // function XG(){
  //   let H=RAH(LQ(),yO);
  //   if($UH())return!0;
  //   let $=jh$();
  //   if(H.projects?.[$]?.hasTrustDialogAccepted)return!0;
  //   let L=gNH(w$());
  //   while(!0){
  //     if(H.projects?.[L]?.hasTrustDialogAccepted)return!0;
  //     let D=gNH(qG.resolve(L,".."));
  //     if(D===L)break;
  //     L=D
  //   }
  //   return!1
  // }
  //
  // Patch: inject `return!0;` at the start of the function body so it always
  // returns true, skipping the trust dialog entirely.

  // Find the function by its unique content: checks hasTrustDialogAccepted
  // and ends with return!1. Use indexOf for the anchor then walk braces to
  // find the enclosing function boundaries.
  const anchor = 'hasTrustDialogAccepted)return!0;';
  const anchorIdx = file.indexOf(anchor);
  if (anchorIdx === -1) {
    console.error(
      'patch: skipTrustDialog: failed to find hasTrustDialogAccepted anchor'
    );
    return null;
  }

  // Walk backwards to find `function XXXX(){`
  const chunk = file.substring(Math.max(0, anchorIdx - 200), anchorIdx);
  const fnMatch = chunk.match(/function ([$\w]+)\(\)\{[^]*$/);
  if (!fnMatch || fnMatch.index === undefined) {
    console.error('patch: skipTrustDialog: failed to find enclosing function');
    return null;
  }

  const fnStart =
    anchorIdx -
    200 +
    Math.max(0, anchorIdx - 200 < 0 ? 200 + (anchorIdx - 200) : 0) +
    fnMatch.index;
  const bodyStart = fnStart + fnMatch[0].indexOf('{');

  // Walk forward from bodyStart counting braces to find the closing }
  let depth = 0;
  let fnEnd = bodyStart;
  for (let i = bodyStart; i < file.length && i < bodyStart + 500; i++) {
    if (file[i] === '{') depth++;
    if (file[i] === '}') {
      depth--;
      if (depth === 0) {
        fnEnd = i + 1;
        break;
      }
    }
  }

  if (depth !== 0) {
    console.error('patch: skipTrustDialog: failed to find closing brace');
    return null;
  }

  // Verify this function ends with return!1
  const fnBody = file.substring(fnStart, fnEnd);
  if (!fnBody.endsWith('return!1}')) {
    console.error(
      'patch: skipTrustDialog: function does not end with return!1}'
    );
    return null;
  }

  const fnHeader = `function ${fnMatch[1]}(){`;
  const replacement = fnHeader + 'return!0}';

  const newFile = file.slice(0, fnStart) + replacement + file.slice(fnEnd);

  showDiff(file, newFile, replacement, fnStart, fnEnd);

  return newFile;
};
