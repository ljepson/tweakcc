import { describe, expect, it, vi } from 'vitest';
import { writeReactiveCompact } from './reactiveCompact';

// Fixture containing all patterns the patch needs to find:
// 1. The prompt-too-long checker function
// 2. The autocompact success path (compact fn, state resetter, post-cleanup fn)
// 3. The error reporter function
// 4. The main null-assignment site
const mockQueryTail =
  'function xK7(H){if(!H.isApiErrorMessage)return!1;let $=H.message.content;if(!Array.isArray($))return!1;return $.some((q)=>q.type==="text")}' +
  'async function doAutoCompact(){let P=await cQ9(H,$,q,!0,void 0,!0,M,j);return AA7($,A,z),sR8(void 0),kP(K),{wasCompacted:!0}}' +
  'function eR3(H){let $=U8(H);try{if(dH(process.env.CLAUDE_CODE_USE_BEDROCK))return}catch{}}' +
  'function jU9(H){for(let $=H.length-1;$>=0;$--){let q=H[$];if(q.type==="user"&&!q.isMeta&&!q.toolUseResult&&!q.isCompactSummary)return $}return 0}' +
  'var rwH=null,$e8=null,MU9=3;' +
  'var sYH=G(()=>{_r();fC();Fo()});';

describe('reactiveCompact', () => {
  it('replaces the dead reactive compact binding with a live helper', () => {
    const result = writeReactiveCompact(mockQueryTail);

    expect(result).not.toBeNull();
    expect(result).toContain('var rwH={');
    // Feature gate always returns true (no longer depends on a minified gate fn)
    expect(result).toContain('isReactiveCompactEnabled(){return!0}');
    // Prompt-too-long checker uses dynamically captured function name
    expect(result).toContain(
      'isWithheldPromptTooLong(H){return H?.type==="assistant"&&H.isApiErrorMessage&&xK7(H)}'
    );
    expect(result).toContain(
      'async tryReactiveCompact({hasAttempted:H,querySource:$,aborted:q,messages:K,cacheSafeParams:_})'
    );
    // Compact function, state resetter, and post-cleanup fn are all dynamic
    expect(result).toContain(
      'let f=await cQ9(K,_.toolUseContext,_,!1,void 0,!1)'
    );
    expect(result).toContain('sR8(void 0),kP($)');
    // Error handling uses name-based check, reporter is dynamic
    expect(result).toContain('f?.name==="AbortError"');
    expect(result).toContain('eR3(f)');
  });

  it('should no-op when reactive compact is already patched', () => {
    const alreadyPatched = mockQueryTail.replace(
      'var rwH=null,$e8=null,MU9=3;',
      'var rwH={isReactiveCompactEnabled(){return!0},isWithheldPromptTooLong(H){return H?.type==="assistant"&&H.isApiErrorMessage&&xK7(H)},isWithheldMediaSizeError(){return!1},async tryReactiveCompact({hasAttempted:H,querySource:$,aborted:q,messages:K,cacheSafeParams:_}){if(H||q||$==="compact"||$==="session_memory")return null;try{let f=await cQ9(K,_.toolUseContext,_,!1,void 0,!1);sR8(void 0),kP($);return f}catch(f){if(f?.name==="AbortError")return null;eR3(f);return null}}},$e8=null,MU9=3;'
    );

    expect(writeReactiveCompact(alreadyPatched)).toBe(alreadyPatched);
  });

  it('returns null when the stub block is missing', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = writeReactiveCompact('var rwH={already:true};');
    expect(result).toBeNull();
    vi.restoreAllMocks();
  });
});
