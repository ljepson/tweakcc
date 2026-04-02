// Please see the note about writing patches in ./index

import { showDiff } from './index';

export const writeReactiveCompact = (oldFile: string): string | null => {
  const pattern =
    /function ([$\w]+)\(H\)\{for\(let \$=H\.length-1;\$>=0;\$--\)\{let q=H\[\$\];if\(q\.type==="user"&&!q\.isMeta&&!q\.toolUseResult&&!q\.isCompactSummary\)return \$}return 0\}var ([$\w]+)=null,([$\w]+)=null,([$\w]+)=3;/;
  const match = oldFile.match(pattern);

  if (!match || match.index === undefined) {
    console.error(
      'patch: reactiveCompact: failed to find reactive compact stub block'
    );
    return null;
  }

  const lastUserMessageFn = match[1];
  const reactiveCompactVar = match[2];
  const skillPrefetchVar = match[3];
  const maxOutputRecoveryVar = match[4];

  const replacement =
    `function ${lastUserMessageFn}(H){for(let $=H.length-1;$>=0;$--){let q=H[$];if(q.type==="user"&&!q.isMeta&&!q.toolUseResult&&!q.isCompactSummary)return $}return 0}` +
    `var ${reactiveCompactVar}={` +
    `isReactiveCompactEnabled(){return LG()},` +
    `isWithheldPromptTooLong(H){return H?.type==="assistant"&&H.isApiErrorMessage&&Ke8(H)},` +
    `isWithheldMediaSizeError(){return!1},` +
    `async tryReactiveCompact({hasAttempted:H,querySource:$,aborted:q,messages:K,cacheSafeParams:_}){` +
    `if(H||q||$==="compact"||$==="session_memory")return null;` +
    `try{let f=await MyH(K,_.toolUseContext,_,!1,void 0,!1);I6H(void 0),jp($),Gt();return f}` +
    `catch(f){if(bt(f,Bo)||bt(f,rhH)||bt(f,ihH))return null;YH(f);return null}` +
    `}` +
    `},${skillPrefetchVar}=null,${maxOutputRecoveryVar}=3;`;

  const startIndex = match.index;
  const endIndex = startIndex + match[0].length;
  const newFile =
    oldFile.slice(0, startIndex) + replacement + oldFile.slice(endIndex);

  showDiff(oldFile, newFile, replacement, startIndex, endIndex);
  return newFile;
};
