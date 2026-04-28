// Please see the note about writing patches in ./index

import { showDiff } from './index';

export const writeMicrocompactFallback = (oldFile: string): string | null => {
  if (
    oldFile.includes(
      'globalThis.__tweakccConfig?.settings.misc?.enableTimeBasedMicrocompact??false'
    ) &&
    oldFile.includes('TIME-BASED MC') &&
    oldFile.includes(
      "{type:'system',subtype:'informational',content:'Time-based microcompact applied',level:'info',uuid:crypto.randomUUID(),timestamp:new Date().toISOString()}"
    )
  ) {
    return oldFile;
  }

  if (
    oldFile.includes('function aS1(H){') &&
    oldFile.includes('body:{context_hint:{enabled:!0}}') &&
    oldFile.includes('FfK(H,$,{keepRecent:oS1})')
  ) {
    return oldFile;
  }

  const contextHintEnabledPattern =
    /function ([$\w]+)\(\)\{return ([$\w]+)\("tengu_hazel_osprey",!1\)\}/;
  const contextHintReturnPattern =
    /return ([$\w]+)\(`\[CONTEXT_HINT_REJECT\] mc=\$\{!!([$\w]+)\} tokensSaved=\$\{\2\?\.tokensSaved\?\?0\}`\),\{messages:([$\w]+),/;
  const contextHintEnabledMatch = oldFile.match(contextHintEnabledPattern);
  const contextHintReturnMatch = oldFile.match(contextHintReturnPattern);

  if (
    contextHintEnabledMatch?.index !== undefined &&
    contextHintReturnMatch?.index !== undefined
  ) {
    const nudgeObj = `{type:'system',subtype:'informational',content:'Time-based microcompact applied',level:'info',uuid:crypto.randomUUID(),timestamp:new Date().toISOString()}`;
    const enabledReplacement = `function ${contextHintEnabledMatch[1]}(){return globalThis.__tweakccConfig?.settings.misc?.enableTimeBasedMicrocompact??false}`;
    let newFile =
      oldFile.slice(0, contextHintEnabledMatch.index) +
      enabledReplacement +
      oldFile.slice(
        contextHintEnabledMatch.index + contextHintEnabledMatch[0].length
      );

    const returnMatchAfterEnable = newFile.match(contextHintReturnPattern);
    if (!returnMatchAfterEnable || returnMatchAfterEnable.index === undefined) {
      console.error(
        'patch: microcompactFallback: failed to find context hint return after enablement'
      );
      return null;
    }

    const resultVar = returnMatchAfterEnable[3];
    const returnReplacement = returnMatchAfterEnable[0].replace(
      `messages:${resultVar},`,
      `messages:[...${resultVar},${nudgeObj}],`
    );
    newFile =
      newFile.slice(0, returnMatchAfterEnable.index) +
      returnReplacement +
      newFile.slice(
        returnMatchAfterEnable.index + returnMatchAfterEnable[0].length
      );

    showDiff(
      oldFile,
      newFile,
      'Microcompact Fallback (Context Hint Enablement)',
      contextHintEnabledMatch.index,
      contextHintEnabledMatch.index + contextHintEnabledMatch[0].length
    );

    return newFile;
  }

  // Step 1: Patch the config object to use our setting instead of just the GB feature gate
  //
  // Old form (pre-2.1.92):
  //   var W7K=Z(()=>{e8();Gg4={enabled:!1,gapThresholdMinutes:60,keepRecent:5}});
  //
  // New form (2.1.92+):
  //   var Hl4;var I9K=Z(()=>{e8();Hl4={enabled:!1,gapThresholdMinutes:60,keepRecent:5}});
  //
  // The config var may be declared inline (old) or hoisted with a separate var (new).
  // Match both by making the leading `var X;` optional.
  // The module initializer call (e8, f9, etc.) is captured dynamically.
  const configPattern =
    /(?:var ([$\w]+);)?var ([$\w]+)=([$\w]+)\(\(\)=>{([$\w]+)\(\);([$\w]+)={enabled:!1,gapThresholdMinutes:60,keepRecent:5}}\);/;
  const configMatch = oldFile.match(configPattern);

  if (!configMatch || configMatch.index === undefined) {
    console.error(
      'patch: microcompactFallback: failed to find config definition'
    );
    return null;
  }

  // Group 1: hoisted var name (may be undefined if old form)
  // Group 2: lazy-init wrapper var name
  // Group 3: lazy-init function name (Z, G, etc.)
  // Group 4: module initializer function name (e8, f9, etc.)
  // Group 5: config object var name (assigned inside the callback)
  const hoistedVar = configMatch[1]; // undefined in old form
  const lazyWrapperVar = configMatch[2];
  const lazyInitFn = configMatch[3];
  const moduleInitFn = configMatch[4];
  const configVar = configMatch[5];

  // Sanity: in the new form, hoistedVar and configVar should be the same identifier
  if (hoistedVar && hoistedVar !== configVar) {
    console.error(
      `patch: microcompactFallback: hoisted var '${hoistedVar}' does not match config var '${configVar}'`
    );
    return null;
  }

  // Step 2: Find the function that returns the microcompact result with messages.
  // The tail of this function looks like:
  //   ...),d0H(),cr(),{messages:w,tokensSaved:Y}}
  // We match the two function calls and the return object at the end.
  // Using a non-greedy scan inside the function body, then capturing the tail.
  const funcPattern =
    /function ([$\w]+)\([$\w]+,[$\w]+(?:,[$\w]+)?\)\{.{10,2000}?([$\w]+)\(\),([$\w]+)\(\),{messages:([$\w]+)(?:,[$\w]+:[$\w]+)*}}/g;

  const funcMatches = Array.from(oldFile.matchAll(funcPattern));
  const funcMatch = funcMatches.find(
    m =>
      m[0].includes('tengu_time_based_microcompact') ||
      m[0].includes('TIME-BASED MC')
  );

  if (!funcMatch || funcMatch.index === undefined) {
    console.error(
      'patch: microcompactFallback: failed to find microcompact function'
    );
    return null;
  }

  const preReturnFn1 = funcMatch[2];
  const preReturnFn2 = funcMatch[3];
  const messagesVar = funcMatch[4];

  let newFile = oldFile;

  // Replace config definition — preserve the hoisted var declaration if present
  const configPrefix = hoistedVar ? `var ${hoistedVar};` : '';
  const configReplacement = `${configPrefix}var ${lazyWrapperVar}=${lazyInitFn}(()=>{${moduleInitFn}();${configVar}={enabled:globalThis.__tweakccConfig?.settings.misc?.enableTimeBasedMicrocompact??false,gapThresholdMinutes:60,keepRecent:5}});`;
  newFile = newFile.replace(configMatch[0], configReplacement);

  // Replace the return statement to inject the system nudge message.
  // Build the old return tail dynamically from captured groups.
  // Match the return object with optional extra fields (e.g., tokensSaved).
  const returnTailPattern = new RegExp(
    escapeRegex(
      `${preReturnFn1}(),${preReturnFn2}(),{messages:${messagesVar}`
    ) +
      '(?:,[$\\w]+:[$\\w]+)*' +
      '}'
  );
  const returnTailMatch = newFile.match(returnTailPattern);

  if (!returnTailMatch) {
    console.error(
      'patch: microcompactFallback: failed to find return statement in modified file'
    );
    return null;
  }

  const returnTailOld = returnTailMatch[0];
  // Strip the trailing } to get the inner content, then rebuild with the spread messages
  const returnObjInner = returnTailOld.slice(
    returnTailOld.indexOf('{messages:') + 1,
    -1
  );
  // returnObjInner is like: messages:w,tokensSaved:Y
  // We need to replace messages:VAR with messages:[...VAR,{nudge}]
  const nudgeObj = `{type:'system',subtype:'informational',content:'Time-based microcompact applied',level:'info',uuid:crypto.randomUUID(),timestamp:new Date().toISOString()}`;
  const newReturnObjInner = returnObjInner.replace(
    `messages:${messagesVar}`,
    `messages:[...${messagesVar},${nudgeObj}]`
  );
  const returnTailNew = `${preReturnFn1}(),${preReturnFn2}(),{${newReturnObjInner}}`;

  if (!newFile.includes(returnTailOld)) {
    console.error(
      'patch: microcompactFallback: return tail not found after config replacement'
    );
    return null;
  }

  newFile = newFile.replace(returnTailOld, returnTailNew);

  showDiff(
    oldFile,
    newFile,
    'Microcompact Fallback (Nudge + Enablement)',
    configMatch.index,
    configMatch.index + configMatch[0].length
  );

  return newFile;
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
