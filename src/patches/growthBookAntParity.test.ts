import { describe, expect, it, vi } from 'vitest';
import { writeGrowthBookAntParity } from './growthBookAntParity';

const mockGrowthBook =
  'function IWH(){if(!FZ8)FZ8=!0;return SCq}' +
  'function OM4(H){let $=IWH();return $!==null&&H in $}' +
  'function bWH(){return}' +
  'function DM4(){if(oS.size>0)return Object.fromEntries(oS);return A$().cachedGrowthBookFeatures??{}}' +
  'function wM4(){return bWH()??{}}' +
  'function MM4(H,$){return}' +
  'function jM4(){return}' +
  'function xCq(H,$,q){let K=IWH();if(K&&H in K)return K[H];let _=bWH();if(_&&H in _)return _[H];return $}' +
  'function B$(H,$){let q=IWH();if(q&&H in q)return q[H];let K=bWH();if(K&&H in K)return K[H];return $}' +
  'function pf(H){let $=IWH();if($&&H in $)return Boolean($[H]);let q=bWH();if(q&&H in q)return Boolean(q[H]);return!1}' +
  'async function cZ8(H){let $=IWH();if($&&H in $)return Boolean($[H]);let q=bWH();if(q&&H in q)return Boolean(q[H]);return!1}';

describe('growthBookAntParity', () => {
  it('should restore env override parsing with config fallback', () => {
    const result = writeGrowthBookAntParity(mockGrowthBook);
    expect(result).not.toBeNull();
    expect(result).toContain('process.env.CLAUDE_INTERNAL_FC_OVERRIDES');
    expect(result).toContain('globalThis.__tweakccGbEnvOverridesCache');
    expect(result).toContain('A$().growthBookOverrides');
    expect(result).toContain('Object.keys(K).length>0');
    expect(result).toContain('return bWH()??A$().growthBookOverrides??{}');
    expect(result).toContain('S$((_)=>({..._,growthBookOverrides');
    expect(result).toContain('HZH.emit()');
  });

  it('should no-op when the GrowthBook parity patch is already present', () => {
    const alreadyPatched =
      'function qZH(){let H=globalThis.__tweakccGbEnvOverridesCache;if(H!==void 0)return H;let $=process.env.CLAUDE_INTERNAL_FC_OVERRIDES;if($){try{return globalThis.__tweakccGbEnvOverridesCache=JSON.parse($)}catch{}}let K=z$().growthBookOverrides;if(K&&Object.keys(K).length>0)return globalThis.__tweakccGbEnvOverridesCache=K;return globalThis.__tweakccGbEnvOverridesCache=null,null}' +
      'function pW4(){if(SR.size>0)return Object.fromEntries(SR);return z$().cachedGrowthBookFeatures??{}}' +
      'function BW4(){return qZH()??z$().growthBookOverrides??{}}';

    expect(writeGrowthBookAntParity(alreadyPatched)).toBe(alreadyPatched);
  });

  it('should return null when the env override stub is missing', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = writeGrowthBookAntParity(
      mockGrowthBook.replace(
        'function bWH(){return}',
        'function bWH(){return null}'
      )
    );
    expect(result).toBeNull();
    vi.restoreAllMocks();
  });
});
