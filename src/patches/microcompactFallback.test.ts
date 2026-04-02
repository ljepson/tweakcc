import { describe, expect, it, vi } from 'vitest';
import { writeMicrocompactFallback } from './microcompactFallback';

const mockMicrocompactFallback =
  'var W7K=G(()=>{e8();Gg4={enabled:!1,gapThresholdMinutes:60,keepRecent:5}});' +
  'function Ng4(H,$){let w=[H,$];console.log("TIME-BASED MC");return CTH(),qr(),{messages:w}}';

describe('microcompactFallback', () => {
  it('should patch enablement and append the informational system nudge', () => {
    const result = writeMicrocompactFallback(mockMicrocompactFallback);
    expect(result).not.toBeNull();
    expect(result).toContain(
      'enabled:globalThis.__tweakccConfig?.settings.misc?.enableTimeBasedMicrocompact??false'
    );
    expect(result).toContain('[TIME-BASED MC]');
    expect(result).toContain(
      "{type:'system',subtype:'informational',content:JOf,level:'info',uuid:vG.randomUUID(),timestamp:new Date().toISOString()}"
    );
  });

  it('should no-op when the patch is already present', () => {
    const alreadyPatched =
      'var W7K=G(()=>{e8();Gg4={enabled:globalThis.__tweakccConfig?.settings.misc?.enableTimeBasedMicrocompact??false,gapThresholdMinutes:60,keepRecent:5}});' +
      "function Ng4(H,$){let w=[H,$];console.log('[TIME-BASED MC]');return CTH(),qr(),{messages:[...w,{type:'system',subtype:'informational',content:JOf,level:'info',uuid:vG.randomUUID(),timestamp:new Date().toISOString()}]}}";

    expect(writeMicrocompactFallback(alreadyPatched)).toBe(alreadyPatched);
  });

  it('should return null when the W7K definition is not found', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = writeMicrocompactFallback('function other(){return null}');
    expect(result).toBeNull();
    vi.restoreAllMocks();
  });
});
