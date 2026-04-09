import { describe, expect, it } from 'vitest';
import { writeFinalizeNoContentRepair } from './finalizeNoContentRepair';

describe('finalizeNoContentRepair', () => {
  it('replaces the synthetic no-content repair branch', () => {
    const oldFile =
      'function ZO7(H){return n$({content:vN,isMeta:!0}) + n$({content:vN,isMeta:!0})}';

    const result = writeFinalizeNoContentRepair(oldFile);

    expect(result).not.toBeNull();
    expect(result).toBe(
      'function ZO7(H){return n$({content:"[Synthetic empty meta message]",isMeta:!0}) + n$({content:"[Synthetic empty meta message]",isMeta:!0})}'
    );
  });

  it('returns unchanged when the repair branch is absent', () => {
    const oldFile = 'function nope(){}';

    expect(writeFinalizeNoContentRepair(oldFile)).toBe(oldFile);
  });

  it('upgrades the older empty synthetic meta repair to the neutral sentinel', () => {
    const oldFile = 'function ZO7(H){return n$({content:"",isMeta:!0})}';

    expect(writeFinalizeNoContentRepair(oldFile)).toBe(
      'function ZO7(H){return n$({content:"[Synthetic empty meta message]",isMeta:!0})}'
    );
  });
});
