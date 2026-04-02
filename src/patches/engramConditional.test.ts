import { describe, expect, it, vi } from 'vitest';
import { writeEngramConditional } from './engramConditional';

const mockGateSnippet =
  'async function eG$(H,$){return XBq(H,$,!0)}' +
  'function u$(H,$){let q=$ZH();if(q&&H in q)return q[H];let K=qZH();if(K&&H in K)return K[H];if(!tn())return $;if(LAH.has(H))CcH(H);else eGH.add(H);if(SR.has(H))return SR.get(H);try{let _=z$().cachedGrowthBookFeatures?.[H];return _!==void 0?_:$}catch{return $}}' +
  'function zV(H,$,q){return u$(H,$)}';

const alreadyPatchedGateSnippet =
  'function u$(H,$){if(globalThis.__engramAvailable&&(H==="tengu_passport_quail"||H==="tengu_moth_copse"))return true;if(globalThis.__engramAvailable===false&&(H==="tengu_passport_quail"||H==="tengu_moth_copse"))return false;let q=$ZH();if(q&&H in q)return q[H];let K=qZH();if(K&&H in K)return K[H];if(!tn())return $;if(LAH.has(H))CcH(H);else eGH.add(H);if(SR.has(H))return SR.get(H);try{let _=z$().cachedGrowthBookFeatures?.[H];return _!==void 0?_:$}catch{return $}}';

describe('engramConditional', () => {
  it('injects conditional feature gate checks', () => {
    const result = writeEngramConditional(mockGateSnippet);

    expect(result).not.toBeNull();
    expect(result).toContain('globalThis.__engramAvailable');
    expect(result).toContain('H==="tengu_passport_quail"||H==="tengu_moth_copse"');
    expect(result).toContain(
      '(async()=>{try{let h=await fetch("https://engram.blissawry.com/mcp/",{method:"OPTIONS",timeout:2000});globalThis.__engramAvailable=h.ok}catch{globalThis.__engramAvailable=false}})();'
    );
  });

  it('returns unchanged when the bundle is already patched', () => {
    expect(writeEngramConditional(alreadyPatchedGateSnippet)).toBe(
      alreadyPatchedGateSnippet
    );
  });

  it('returns null when the feature gate helper is absent', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(writeEngramConditional('function nope(){}')).toBeNull();
    vi.restoreAllMocks();
  });
});
