import { describe, expect, it, vi } from 'vitest';
import { writeFinalizeNoContentRepair } from './finalizeNoContentRepair';

describe('finalizeNoContentRepair', () => {
  it('replaces the synthetic no-content repair branch', () => {
    const oldFile =
      'function ZO7(H){return n$({content:vN,isMeta:!0}) + n$({content:vN,isMeta:!0})}';

    const result = writeFinalizeNoContentRepair(oldFile);

    expect(result).not.toBeNull();
    expect(result).toBe(
      'function ZO7(H){return n$({content:"",isMeta:!0}) + n$({content:"",isMeta:!0})}'
    );
  });

  it('returns null when the repair branch is absent', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(writeFinalizeNoContentRepair('function nope(){}')).toBeNull();

    vi.restoreAllMocks();
  });
});
