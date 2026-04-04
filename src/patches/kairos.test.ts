import { describe, expect, it } from 'vitest';
import { writeKairos } from './kairos';

// Minimal mock bundle matching the structural patterns the patch looks for.
// Names are intentionally different from any real CC build to prove dynamic capture works.
const mockBundle = `
function gF(H,$){if(H==="some_flag")return true;return $_(H,$)}
if(!dH(process.env.X))gF("tengu_kairos_cron",!0,ctx)
return{defaultSystemPrompt:[],userContext:[],systemContext:[]}
class Ink9{options;state;constructor(P){this.options=P;this.stdout={on:()=>{}}}}
function wGet(){return als.getStore()?.workload}
wkC="cron"
let sched=null;if(cronMgr&&cronCfg?.isKairosCronEnabled())sched=cronMgr.createCronScheduler({onFire:(ev)=>{if(killed)return;inject({mode:"prompt",value:ev,uuid:uSrc.randomUUID(),priority:"later",isMeta:!0,workload:wkC}),flush()},isLoading:()=>loading||killed
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

  it('should patch the feature gate function using dynamic name discovery', () => {
    const result = writeKairos(mockBundle);
    // Should find gF from the call site and inject into its definition
    expect(result).toContain('tengu_kairos_cron');
    expect(result).toContain('tengu_kairos_brief');
    // Uses the captured first param name (H) dynamically
    expect(result).toContain('H==="tengu_kairos_cron"');
  });

  it('should patch the system prompt to include KAIROS auto-mode fragment', () => {
    const result = writeKairos(mockBundle);
    expect(result).toContain('getSystemPromptFragment()');
    expect(result).toContain('[KAIROS AUTO-MODE]');
    expect(result).toContain('User is watching');
    expect(result).toContain('User is away');
  });

  it('should inject focus tracking into the Ink class using dynamic names', () => {
    const result = writeKairos(mockBundle);
    // Should use the captured constructor param (P), not hardcoded H
    expect(result).toContain('P.stdout.on("focus_gained"');
    expect(result).toContain('P.stdout.on("focus_lost"');
  });

  it('should inject tick loop with dynamically captured variable names', () => {
    const result = writeKairos(mockBundle);
    // Should use captured names from the cron scheduler block
    expect(result).toContain('inject({mode:"prompt"');
    expect(result).toContain('uSrc.randomUUID()');
    expect(result).toContain('workload:wkC');
    expect(result).toContain('flush()');
    expect(result).toContain('!loading');
    expect(result).toContain('!killed');
  });

  it('should inject cost tracking with dynamically captured workload names', () => {
    const result = writeKairos(mockBundle);
    expect(result).toContain('autonomousCostUsd');
    // Should use captured workload getter (wGet) and cron constant (wkC)
    expect(result).toContain('wGet()===wkC');
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
    const minimal = `some unrelated code`;
    const result = writeKairos(minimal);
    // Should still inject the KairosManager class at minimum
    expect(result).toContain('globalThis.__tweakccKairos');
  });
});
