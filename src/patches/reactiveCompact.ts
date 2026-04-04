// Please see the note about writing patches in ./index

import { showDiff } from './index';

export const writeReactiveCompact = (oldFile: string): string | null => {
  if (
    oldFile.includes('isReactiveCompactEnabled(){return!0}') &&
    oldFile.includes(
      'isWithheldPromptTooLong(H){return H?.type==="assistant"&&H.isApiErrorMessage&&'
    ) &&
    oldFile.includes(
      'async tryReactiveCompact({hasAttempted:H,querySource:$,aborted:q,messages:K,cacheSafeParams:_})'
    )
  ) {
    return oldFile;
  }

  // -----------------------------------------------------------------------
  // Step 1: Find the null-assignment site (the main anchor)
  // -----------------------------------------------------------------------
  const sitePattern =
    /function ([$\w]+)\(H\)\{for\(let \$=H\.length-1;\$>=0;\$--\)\{let q=H\[\$\];if\(q\.type==="user"&&!q\.isMeta&&!q\.toolUseResult&&!q\.isCompactSummary\)return \$}return 0\}var ([$\w]+)=null,([$\w]+)=null,([$\w]+)=3;/;
  const siteMatch = oldFile.match(sitePattern);

  if (!siteMatch || siteMatch.index === undefined) {
    console.error(
      'patch: reactiveCompact: failed to find reactive compact stub block'
    );
    return null;
  }

  const lastUserMessageFn = siteMatch[1];
  const reactiveCompactVar = siteMatch[2];
  const skillPrefetchVar = siteMatch[3];
  const maxOutputRecoveryVar = siteMatch[4];

  // -----------------------------------------------------------------------
  // Step 2: Find the prompt-too-long checker function
  //   function t$6(H){if(!H.isApiErrorMessage)return!1;let $=H.message.content...
  // -----------------------------------------------------------------------
  const ptlPattern =
    /function ([$\w]+)\([$\w]+\)\{if\(![$\w]+\.isApiErrorMessage\)return!1;let [$\w]+=[$\w]+\.message\.content/;
  const ptlMatch = oldFile.match(ptlPattern);

  if (!ptlMatch) {
    console.error(
      'patch: reactiveCompact: failed to find prompt-too-long checker function'
    );
    return null;
  }

  const promptTooLongFn = ptlMatch[1];

  // -----------------------------------------------------------------------
  // Step 3: Find the compact function, state resetter, and post-cleanup fn
  //   from the autocompact success path:
  //   await COMPACT(H,$,q,!0,void 0,!0,M,j);return X($,A,z),RESET(void 0),CLEANUP(K),{wasCompacted:!0
  // -----------------------------------------------------------------------
  const autocompactPattern =
    /await ([$\w]+)\([$\w]+,[$\w]+,[$\w]+,!0,void 0,!0,[$\w]+,[$\w]+\);return [$\w]+\([$\w]+,[$\w]+,[$\w]+\),([$\w]+)\(void 0\),([$\w]+)\([$\w]+\),\{wasCompacted:!0/;
  const autocompactMatch = oldFile.match(autocompactPattern);

  if (!autocompactMatch) {
    console.error(
      'patch: reactiveCompact: failed to find autocompact success path'
    );
    return null;
  }

  const compactFn = autocompactMatch[1];
  const stateResetFn = autocompactMatch[2];
  const postCleanupFn = autocompactMatch[3];

  // -----------------------------------------------------------------------
  // Step 4: Find the error reporter function
  //   function YH(H){let $=U8(H);try{if(dH(process.env.CLAUDE_CODE_USE_BEDROCK)...
  // -----------------------------------------------------------------------
  const reporterPattern =
    /function ([$\w]+)\([$\w]+\)\{let [$\w]+=[$\w]+\([$\w]+\);try\{if\([$\w]+\(process\.env\.CLAUDE_CODE_USE_BEDROCK\)/;
  const reporterMatch = oldFile.match(reporterPattern);

  if (!reporterMatch) {
    console.error(
      'patch: reactiveCompact: failed to find error reporter function'
    );
    return null;
  }

  const errorReporterFn = reporterMatch[1];

  // -----------------------------------------------------------------------
  // Step 5: Build the replacement
  // -----------------------------------------------------------------------
  const replacement =
    `function ${lastUserMessageFn}(H){for(let $=H.length-1;$>=0;$--){let q=H[$];if(q.type==="user"&&!q.isMeta&&!q.toolUseResult&&!q.isCompactSummary)return $}return 0}` +
    `var ${reactiveCompactVar}={` +
    `isReactiveCompactEnabled(){return!0},` +
    `isWithheldPromptTooLong(H){return H?.type==="assistant"&&H.isApiErrorMessage&&${promptTooLongFn}(H)},` +
    `isWithheldMediaSizeError(){return!1},` +
    `async tryReactiveCompact({hasAttempted:H,querySource:$,aborted:q,messages:K,cacheSafeParams:_}){` +
    `if(H||q||$==="compact"||$==="session_memory")return null;` +
    `try{let f=await ${compactFn}(K,_.toolUseContext,_,!1,void 0,!1);${stateResetFn}(void 0),${postCleanupFn}($);return f}` +
    `catch(f){if(f?.name==="AbortError")return null;${errorReporterFn}(f);return null}` +
    `}` +
    `},${skillPrefetchVar}=null,${maxOutputRecoveryVar}=3;`;

  const startIndex = siteMatch.index;
  const endIndex = startIndex + siteMatch[0].length;
  const newFile =
    oldFile.slice(0, startIndex) + replacement + oldFile.slice(endIndex);

  showDiff(oldFile, newFile, replacement, startIndex, endIndex);
  return newFile;
};
