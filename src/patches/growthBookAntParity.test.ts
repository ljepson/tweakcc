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
  it('should restore env override parsing and disk override reads', () => {
    const result = writeGrowthBookAntParity(mockGrowthBook);
    expect(result).not.toBeNull();
    expect(result).toContain('process.env.CLAUDE_INTERNAL_FC_OVERRIDES');
    expect(result).toContain('globalThis.__tweakccGbEnvOverridesCache');
    expect(result).toContain('return bWH()??A$().growthBookOverrides??{}');
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
