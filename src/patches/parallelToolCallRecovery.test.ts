import { describe, expect, it } from 'vitest';
import { writeParallelToolCallRecovery } from './parallelToolCallRecovery';

const HELPER_DECLARATION = 'function __tweakccRecoverParallelToolCalls';

describe('parallelToolCallRecovery', () => {
  it('returns unchanged when already patched', () => {
    const input =
      'function __tweakccRecoverParallelToolCalls(){}function n7H(H,$){return H}';

    expect(writeParallelToolCallRecovery(input)).toBe(input);
  });

  it('returns unchanged when native recovery is already present', () => {
    const input =
      'function UT1(H,$,q){return $}c("tengu_chain_parallel_tr_recovered",{})';

    expect(writeParallelToolCallRecovery(input)).toBe(input);
  });

  it('patches legacy transcript chain recovery', () => {
    const input =
      'function n7H(H,$){let q=[],K=new Set,_=$;while(_){if(K.has(_.uuid)){break}K.add(_.uuid),q.push(_);let f=_.parentUuid;if(!f)break;let A=H.get(f);_=A}return q.reverse()}';

    const result = writeParallelToolCallRecovery(input);

    expect(result).not.toBeNull();
    expect(result).toContain('__tweakccRecoverParallelToolCalls');
    expect(result).toContain(
      'enableParallelToolCallRecovery?__tweakccRecoverParallelToolCalls(H,q,K):q'
    );
  });

  it('injects the helper inside the Bun wrapper when present', () => {
    const input = `(function(exports, require, module, __filename, __dirname) {
function n7H(H,$){let q=[],K=new Set,_=$;while(_){if(K.has(_.uuid)){break}K.add(_.uuid),q.push(_);let f=_.parentUuid;if(!f)break;let A=H.get(f);_=A}return q.reverse()}
})`;

    const result = writeParallelToolCallRecovery(input);

    expect(result).not.toBeNull();
    expect(result).toContain(HELPER_DECLARATION);
    expect(result).toContain(
      '(function(exports, require, module, __filename, __dirname) {\nfunction __tweakccRecoverParallelToolCalls'
    );
  });

  it('returns null when no legacy chain function is found', () => {
    expect(writeParallelToolCallRecovery('function otherFn(){return 1}')).toBe(
      null
    );
  });
});
