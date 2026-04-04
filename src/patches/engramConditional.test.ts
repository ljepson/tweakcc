import { describe, expect, it, vi } from 'vitest';
import { writeEngramConditional } from './engramConditional';

// 2.1.89-era identifiers
const mockGateSnippet_2_1_89 =
  'async function eG$(H,$){return XBq(H,$,!0)}' +
  'function u$(H,$){let q=$ZH();if(q&&H in q)return q[H];let K=qZH();if(K&&H in K)return K[H];if(!tn())return $;if(LAH.has(H))CcH(H);else eGH.add(H);if(SR.has(H))return SR.get(H);try{let _=z$().cachedGrowthBookFeatures?.[H];return _!==void 0?_:$}catch{return $}}' +
  'function zV(H,$,q){return u$(H,$)}';

// 2.1.92-era identifiers (function name and internal calls all changed)
const mockGateSnippet_2_1_92 =
  'async function KT$(H,$){return TFq(H,$,!0)}' +
  'function C$(H,$){let q=HvH();if(q&&H in q)return q[H];let K=$vH();if(K&&H in K)return K[H];if(!Qi())return $;if(OzH.has(H))PlH(H);else tZH.add(H);if(MI.has(H))return MI.get(H);try{let _=z$().cachedGrowthBookFeatures?.[H];return _!==void 0?_:$}catch{return $}}' +
  'function DI(H,$,q){return C$(H,$)}';

const mockGateSnippet = mockGateSnippet_2_1_89;

const alreadyPatchedGateSnippet =
  'function u$(H,$){if(globalThis.__engramAvailable&&(H==="tengu_passport_quail"||H==="tengu_moth_copse"))return true;if(globalThis.__engramAvailable===false&&(H==="tengu_passport_quail"||H==="tengu_moth_copse"))return false;let q=$ZH();if(q&&H in q)return q[H];let K=qZH();if(K&&H in K)return K[H];if(!tn())return $;if(LAH.has(H))CcH(H);else eGH.add(H);if(SR.has(H))return SR.get(H);try{let _=z$().cachedGrowthBookFeatures?.[H];return _!==void 0?_:$}catch{return $}}';

describe('engramConditional', () => {
  it('injects conditional feature gate checks', () => {
    const result = writeEngramConditional(mockGateSnippet);

    expect(result).not.toBeNull();
    expect(result).toContain('globalThis.__engramAvailable');
    expect(result).toContain(
      'H==="tengu_passport_quail"||H==="tengu_moth_copse"'
    );
    // New fail-closed probe pattern
    expect(result).toContain('globalThis.__engramAvailable=false;');
    expect(result).toContain('if(h.ok)globalThis.__engramAvailable=true');
  });

  it('returns unchanged when the bundle is already patched', () => {
    expect(writeEngramConditional(alreadyPatchedGateSnippet)).toBe(
      alreadyPatchedGateSnippet
    );
  });

  it('injects conditional feature gate checks for 2.1.92 identifiers', () => {
    const result = writeEngramConditional(mockGateSnippet_2_1_92);

    expect(result).not.toBeNull();
    expect(result).toContain('globalThis.__engramAvailable');
    expect(result).toContain('"tengu_passport_quail"');
    expect(result).toContain('"tengu_moth_copse"');
    // Verify function name is captured dynamically, not hardcoded
    expect(result).toContain(
      'function C$(H,$){if(globalThis.__engramAvailable'
    );
  });

  it('returns null when the feature gate helper is absent', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(writeEngramConditional('function nope(){}')).toBeNull();
    vi.restoreAllMocks();
  });
});
