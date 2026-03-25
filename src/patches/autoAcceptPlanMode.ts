// Please see the note about writing patches in ./index
//
// Auto-Accept Plan Mode Patch - Skip the plan approval prompt
//
// When Claude finishes writing a plan and calls ExitPlanMode, the user is shown
// a "Ready to code?" dialog with options to approve or continue editing the plan.
// This patch automatically selects "Yes, clear context and auto-accept edits"
// without requiring user interaction.
//
// The accept handler function name varies between minified versions (e.g., "e"
// in 2.1.31, "t" in 2.1.22), so we detect it dynamically from the onChange prop.
//
// CC 2.1.22:
// ```diff
//  if(Q)return F5.default.createElement(Sw,{...title:"Exit plan mode?"...});
// +t("yes-accept-edits");return null;
//  return F5.default.createElement(F5.default.Fragment,null,
//    F5.default.createElement(Sw,{color:"planMode",title:"Ready to code?",...
// ```
//
// CC 2.1.31:
// ```diff
//  if(Q)return R8.default.createElement(fq,{...title:"Exit plan mode?"...});
// +e("yes-accept-edits");return null;
//  return R8.default.createElement(R8.default.Fragment,null,
//    R8.default.createElement(fq,{color:"planMode",title:"Ready to code?",...
// ```

import { showDiff } from './index';

/**
 * Patch the plan approval component to auto-accept.
 *
 * Finds the "Ready to code?" return statement and inserts an early
 * call to the accept handler function, bypassing the approval UI.
 */
export const writeAutoAcceptPlanMode = (oldFile: string): string | null => {
  const readyIdx = oldFile.indexOf('title:"Ready to code?"');
  if (readyIdx === -1) {
    console.error(
      'patch: autoAcceptPlanMode: failed to find "Ready to code?" title'
    );
    return null;
  }

  // Check if already patched
  const alreadyPatchedPattern =
    /(?:[$\w]+\("yes-accept-edits"\)|[$\w]+\.onAllow\(\{\},);return null;return/;
  if (alreadyPatchedPattern.test(oldFile)) {
    return oldFile;
  }

  // Strategy 1 (CC <=2.1.82): Find accept handler via onChange arrow function
  const afterReady = oldFile.slice(readyIdx, readyIdx + 3000);
  const onChangeMatch = afterReady.match(
    /onChange:\([$\w]+\)=>([$\w]+)\([$\w]+\),onCancel/
  );

  if (onChangeMatch) {
    const acceptFuncName = onChangeMatch[1];

    const pattern =
      /(\}\}\)\)\)\);)(return [$\w]+\.default\.createElement\([$\w]+\.default\.Fragment,null,[$\w]+\.default\.createElement\([$\w]+,\{color:"planMode",title:"Ready to code\?")/;

    const match = oldFile.match(pattern);
    if (match && match.index !== undefined) {
      const insertion = `${acceptFuncName}("yes-accept-edits");return null;`;
      const replacement = match[1] + insertion + match[2];
      const startIndex = match.index;
      const endIndex = startIndex + match[0].length;
      const newFile =
        oldFile.slice(0, startIndex) + replacement + oldFile.slice(endIndex);
      showDiff(oldFile, newFile, replacement, startIndex, endIndex);
      return newFile;
    }
  }

  // Strategy 2 (CC 2.1.83+): Inline onChange, find props.onAllow call directly
  const nearbyChunk = oldFile.slice(Math.max(0, readyIdx - 3000), readyIdx);
  const onAllowMatch = nearbyChunk.match(
    /([$\w]+)\.onAllow\(\{\},\[\{type:"setMode",mode:"default",destination:"session"\}\]\)/
  );
  if (!onAllowMatch) {
    console.error('patch: autoAcceptPlanMode: failed to find onChange handler');
    return null;
  }
  const propsVar = onAllowMatch[1];

  // Find the injection point: }))));return before "Ready to code?"
  // The return may be createElement(Fragment,...) or createElement(Box,{...})
  const returnPattern =
    /(\}\)\)\)\);)(return [$\w]+\.default\.createElement\([$\w]+,(?:\{[^}]*\}|null),[$\w]+\.default\.createElement\([$\w]+,\{(?:color:"planMode",)?title:"Ready to code\?")/;
  const match = oldFile.match(returnPattern);
  if (!match || match.index === undefined) {
    console.error(
      'patch: autoAcceptPlanMode: failed to find "Ready to code?" return pattern'
    );
    return null;
  }

  const insertion = `${propsVar}.onAllow({},[{type:"setMode",mode:"default",destination:"session"}]);return null;`;
  const replacement = match[1] + insertion + match[2];
  const startIndex = match.index;
  const endIndex = startIndex + match[0].length;
  const newFile =
    oldFile.slice(0, startIndex) + replacement + oldFile.slice(endIndex);
  showDiff(oldFile, newFile, replacement, startIndex, endIndex);
  return newFile;
};
