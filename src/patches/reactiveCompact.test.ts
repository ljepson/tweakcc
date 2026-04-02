import { describe, expect, it, vi } from 'vitest';
import { writeReactiveCompact } from './reactiveCompact';

const mockQueryTail =
  'function jU9(H){for(let $=H.length-1;$>=0;$--){let q=H[$];if(q.type==="user"&&!q.isMeta&&!q.toolUseResult&&!q.isCompactSummary)return $}return 0}' +
  'var rwH=null,$e8=null,MU9=3;' +
  'var sYH=G(()=>{_r();fC();Fo()});';

describe('reactiveCompact', () => {
  it('replaces the dead reactive compact binding with a live helper', () => {
    const result = writeReactiveCompact(mockQueryTail);

    expect(result).not.toBeNull();
    expect(result).toContain('var rwH={');
    expect(result).toContain('isReactiveCompactEnabled(){return LG()}');
    expect(result).toContain(
      'isWithheldPromptTooLong(H){return H?.type==="assistant"&&H.isApiErrorMessage&&Ke8(H)}'
    );
    expect(result).toContain(
      'async tryReactiveCompact({hasAttempted:H,querySource:$,aborted:q,messages:K,cacheSafeParams:_})'
    );
    expect(result).toContain(
      'let f=await MyH(K,_.toolUseContext,_,!1,void 0,!1)'
    );
  });

  it('should no-op when reactive compact is already patched', () => {
    const alreadyPatched =
      'var rwH={isReactiveCompactEnabled(){return LG()},isWithheldPromptTooLong(H){return H?.type==="assistant"&&H.isApiErrorMessage&&Ke8(H)},isWithheldMediaSizeError(){return!1},async tryReactiveCompact({hasAttempted:H,querySource:$,aborted:q,messages:K,cacheSafeParams:_}){if(H||q||$==="compact"||$==="session_memory")return null;try{let f=await MyH(K,_.toolUseContext,_,!1,void 0,!1);I6H(void 0),jp($),Gt();return f}catch(f){if(bt(f,Bo)||bt(f,rhH)||bt(f,ihH))return null;YH(f);return null}}},$e8=null,MU9=3;';

    expect(writeReactiveCompact(alreadyPatched)).toBe(alreadyPatched);
  });

  it('returns null when the stub block is missing', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = writeReactiveCompact('var rwH={already:true};');
    expect(result).toBeNull();
    vi.restoreAllMocks();
  });
});
