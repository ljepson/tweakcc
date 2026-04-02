import { describe, expect, it } from 'vitest';
import { writeKairos } from './kairos';

// Minimal mock bundle - real bundle has much more context
// These tests verify the injection patterns work
const mockBundle = `
var kCron=null;if(foo&&bar?.isKairosCronEnabled())
function u$(H,$){if(H==="some_flag")return true;return $_(H,$)}
return{defaultSystemPrompt:[],userContext:[],systemContext:[]}
class cQH{constructor(H){this.options=H;this.stdout={on:()=>{}}}}
let x=null;if(a&&b?.isKairosCronEnabled())
this.totalUsage=mergeUsage(this.totalUsage,usage)
`;

describe('writeKairos', () => {
  it('should inject the KairosManager class at the start of the bundle', () => {
    const result = writeKairos(mockBundle);
    expect(result).toContain(
      'globalThis.__tweakccKairos = new class KairosManager'
    );
    expect(result).toContain('isKairosEnabled()');
    expect(result).toContain('updateFocus(focused)');
    expect(result).toContain('checkTick(onFire)');
  });

  it('should patch the u$ function to enable KAIROS feature gates', () => {
    const result = writeKairos(mockBundle);
    expect(result).toContain('tengu_kairos_cron');
    expect(result).toContain('tengu_kairos_brief');
  });

  it('should patch the system prompt to include KAIROS auto-mode fragment', () => {
    const result = writeKairos(mockBundle);
    expect(result).toContain('getSystemPromptFragment()');
    expect(result).toContain('[KAIROS AUTO-MODE]');
    expect(result).toContain('User is watching');
    expect(result).toContain('User is away');
  });

  it('should inject focus tracking into the Ink component', () => {
    const result = writeKairos(mockBundle);
    // Focus tracking is injected into cQH class constructor
    expect(result).toContain('focus_gained');
    expect(result).toContain('focus_lost');
  });

  it('should inject cost tracking into usage aggregation', () => {
    const result = writeKairos(mockBundle);
    expect(result).toContain('autonomousCostUsd');
  });

  it('should initialize tick interval to 4.5 minutes', () => {
    const result = writeKairos(mockBundle);
    expect(result).toContain('tickIntervalMs = 270000');
  });

  it('should check for kairos-stop file to enter deep sleep', () => {
    const result = writeKairos(mockBundle);
    expect(result).toContain('kairos-stop');
    expect(result).toContain('isDeepSleep = true');
  });

  it('should handle missing patterns gracefully', () => {
    // writeKairos doesn't have explicit idempotency check, but shouldn't break
    const minimal = `function u$(H,$){return $_(H,$)}`;
    const result = writeKairos(minimal);
    // Should still inject the KairosManager class at minimum
    expect(result).toContain('globalThis.__tweakccKairos');
  });
});
