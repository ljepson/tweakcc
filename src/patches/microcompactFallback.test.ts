import { describe, expect, it, vi } from 'vitest';
import { writeMicrocompactFallback } from './microcompactFallback';

// Old form: config var declared inline (pre-2.1.92)
const mockOldForm =
  'var W7K=G(()=>{f9();Gg4={enabled:!1,gapThresholdMinutes:60,keepRecent:5}});' +
  'function Ng4(H,$){let w=[H,$];console.log("TIME-BASED MC");return CTH(),qr(),{messages:w}}';

// New form: config var hoisted with separate var declaration (2.1.92+)
const mockNewForm =
  'var Hl4;var I9K=Z(()=>{xQ();Hl4={enabled:!1,gapThresholdMinutes:60,keepRecent:5}});' +
  'function Al4(H,$,q){let w=[H,$];console.log("TIME-BASED MC");return d0H(),cr(),{messages:w,tokensSaved:Y}}';

describe('microcompactFallback', () => {
  it('should patch enablement and append the informational system nudge (old form)', () => {
    const result = writeMicrocompactFallback(mockOldForm);
    expect(result).not.toBeNull();
    expect(result).toContain(
      'enabled:globalThis.__tweakccConfig?.settings.misc?.enableTimeBasedMicrocompact??false'
    );
    expect(result).toContain('TIME-BASED MC');
    expect(result).toContain(
      "{type:'system',subtype:'informational',content:'Time-based microcompact applied',level:'info',uuid:crypto.randomUUID(),timestamp:new Date().toISOString()}"
    );
    // Verify captured module initializer is used (not hardcoded e8)
    expect(result).toContain('f9();Gg4={enabled:globalThis');
  });

  it('should patch enablement and append the informational system nudge (new form)', () => {
    const result = writeMicrocompactFallback(mockNewForm);
    expect(result).not.toBeNull();
    expect(result).toContain(
      'enabled:globalThis.__tweakccConfig?.settings.misc?.enableTimeBasedMicrocompact??false'
    );
    expect(result).toContain('var Hl4;var I9K=Z');
    expect(result).toContain('TIME-BASED MC');
    expect(result).toContain(
      "{type:'system',subtype:'informational',content:'Time-based microcompact applied',level:'info',uuid:crypto.randomUUID(),timestamp:new Date().toISOString()}"
    );
    // Preserve extra return fields
    expect(result).toContain('tokensSaved:Y');
    // Verify captured module initializer is used (not hardcoded e8)
    expect(result).toContain('xQ();Hl4={enabled:globalThis');
  });

  it('should no-op when the patch is already present', () => {
    const alreadyPatched =
      'var Hl4;var I9K=Z(()=>{e8();Hl4={enabled:globalThis.__tweakccConfig?.settings.misc?.enableTimeBasedMicrocompact??false,gapThresholdMinutes:60,keepRecent:5}});' +
      "function Al4(H,$,q){let w=[H,$];console.log('TIME-BASED MC');return d0H(),cr(),{messages:[...w,{type:'system',subtype:'informational',content:'Time-based microcompact applied',level:'info',uuid:crypto.randomUUID(),timestamp:new Date().toISOString()}],tokensSaved:Y}}";

    expect(writeMicrocompactFallback(alreadyPatched)).toBe(alreadyPatched);
  });

  it('should return null when the config definition is not found', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = writeMicrocompactFallback('function other(){return null}');
    expect(result).toBeNull();
    vi.restoreAllMocks();
  });
});
