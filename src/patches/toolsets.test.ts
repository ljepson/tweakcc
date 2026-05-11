import { describe, expect, it, vi } from 'vitest';
import {
  writeToolsetFieldToAppState,
  appendToolsetToModeDisplay,
  insertShiftTabAppStateVar,
} from './toolsets';
// import type { Toolset } from '../types';

// Minimal mock bundle with necessary patterns for basic tests
// Note: Most toolset helper functions require realistic Claude Code bundle
// patterns that are too complex to mock. They're tested via integration tests.
const mockBundle = `
thinkingEnabled:getThinkingEnabled()
`;

// const toolsets: Toolset[] = [
//   { name: 'minimal', allowedTools: ['Read', 'Write', 'Bash'] },
//   { name: 'full', allowedTools: '*' },
// ];

describe('toolsets helpers', () => {
  describe('writeToolsetFieldToAppState', () => {
    it('should add toolset field after thinkingEnabled', () => {
      const result = writeToolsetFieldToAppState(mockBundle, 'minimal');
      expect(result).not.toBeNull();
      expect(result).toContain(',toolset:"minimal"');
    });

    it('should use undefined when no default toolset', () => {
      const result = writeToolsetFieldToAppState(mockBundle, null);
      expect(result).not.toBeNull();
      expect(result).toContain(',toolset:undefined');
    });

    it('should return null if thinkingEnabled pattern not found', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = writeToolsetFieldToAppState('no thinking here', 'minimal');
      expect(result).toBeNull();
      vi.restoreAllMocks();
    });
  });
});

describe('appendToolsetToModeDisplay', () => {
  // Fixture extracted from CC 2.1.92 cli.js — real bundle context around the match point.
  // The mode var is $H (dollar-prefixed), tlFunction is fn.
  const realBundleFragment = `OH=$H&&wH&&!L_()?Dq.createElement(T,{color:sT($H),key:"mode"},nBH($H)," ",fn($H).toLowerCase()," on",r&&Dq.createElement(T,{dimColor:!0}," ",Dq.createElement(l$,{chord:w,action:"cycle",parens:!0,format:{keyCase:"lower"}})))`;

  // Synthetic fixture with a plain (non-$) identifier for the mode variable.
  const plainVarFragment = `someMode&&Dq.createElement(T,{color:sT(mode),key:"mode"},nBH(mode)," ",fn(mode).toLowerCase()," on",r&&Dq.createElement(T,{dimColor:!0}))`;

  it('matches $-prefixed mode variable (regression: CC 2.1.92 pattern)', () => {
    const result = appendToolsetToModeDisplay(realBundleFragment);
    expect(result).not.toBeNull();
  });

  it('replaces " on" with conditional toolset suffix for $-prefixed var', () => {
    const result = appendToolsetToModeDisplay(realBundleFragment);
    // Old literal " on" must be gone
    expect(result).not.toContain('," on"');
    // New pattern uses template literal with currentToolset
    expect(result).toContain('currentToolset');
    expect(result).toContain('fn($H).toLowerCase()');
  });

  it('captures the correct tlFunction and modeVar from the replacement', () => {
    const result = appendToolsetToModeDisplay(realBundleFragment)!;
    // The replacement is: fn($H).toLowerCase(),currentToolset?` on [${currentToolset}]`:""
    expect(result).toMatch(/fn\(\$H\)\.toLowerCase\(\),currentToolset\?/);
  });

  it('matches plain (non-$) mode variable identifier', () => {
    const result = appendToolsetToModeDisplay(plainVarFragment);
    expect(result).not.toBeNull();
    expect(result).toContain('fn(mode).toLowerCase()');
    expect(result).toContain('currentToolset');
    expect(result).not.toContain('," on"');
  });

  it('returns null when pattern is absent', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = appendToolsetToModeDisplay('no mode display here');
    expect(result).toBeNull();
    vi.restoreAllMocks();
  });

  it('does not mutate content that already has no match', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const input = 'unrelated bundle content';
    const result = appendToolsetToModeDisplay(input);
    expect(result).toBeNull();
    vi.restoreAllMocks();
  });
});

describe('insertShiftTabAppStateVar', () => {
  it('inserts currentToolset into the same component as the mode display', () => {
    const input =
      'useAppState function w$(selector){return React.useSyncExternalStore(a,b,selector)} function c6(){return store().setState}' +
      'function rI4(H){let $=cache.c(1),{mode:wH}=H;return fn(wH).toLowerCase()," on"}' +
      'function kp5(H){return {color:"bashBorder"},"! for bash mode"}';

    const result = insertShiftTabAppStateVar(input, 'SUDO', '2.1.138');

    expect(result).not.toBeNull();
    expect(result).toContain(
      'function rI4(H){/*twkcc:ts-stln:2.1.138*/let currentToolset=w$(state => state.toolset) ?? "SUDO";let $=cache.c(1)'
    );
    expect(result).toContain(
      'function kp5(H){return {color:"bashBorder"},"! for bash mode"}'
    );
  });

  it('does not treat an out-of-scope existing sentinel as already applied', () => {
    const input =
      'useAppState function w$(selector){return React.useSyncExternalStore(a,b,selector)} function c6(){return store().setState}' +
      'function rI4(H){let $=cache.c(1),{mode:wH}=H;return fn(wH).toLowerCase()," on"}' +
      'function kp5(H){/*twkcc:ts-stln:2.1.138*/let currentToolset=w$(state => state.toolset) ?? "SUDO";return {color:"bashBorder"},"! for bash mode"}';

    const result = insertShiftTabAppStateVar(input, 'SUDO', '2.1.138');

    expect(result).not.toBeNull();
    expect(result).toContain(
      'function rI4(H){/*twkcc:ts-stln:2.1.138*/let currentToolset=w$(state => state.toolset) ?? "SUDO";let $=cache.c(1)'
    );
    expect(result).toContain(
      'function kp5(H){/*twkcc:ts-stln:2.1.138*/let currentToolset=w$(state => state.toolset) ?? "SUDO";return {color:"bashBorder"},"! for bash mode"}'
    );
  });

  it('can repair an already mode-patched bundle with the sentinel out of scope', () => {
    const input =
      'useAppState function w$(selector){return React.useSyncExternalStore(a,b,selector)} function c6(){return store().setState}' +
      'function rI4(H){let $=cache.c(1),{mode:wH}=H;return /*twkcc:ts-mode:2.1.138*/fn(wH).toLowerCase(),currentToolset?` on [${currentToolset}]`:""}' +
      'function kp5(H){/*twkcc:ts-stln:2.1.138*/let currentToolset=w$(state => state.toolset) ?? "SUDO";return {color:"bashBorder"},"! for bash mode"}';

    const result = insertShiftTabAppStateVar(input, 'SUDO', '2.1.138');

    expect(result).not.toBeNull();
    expect(result).toContain(
      'function rI4(H){/*twkcc:ts-stln:2.1.138*/let currentToolset=w$(state => state.toolset) ?? "SUDO";let $=cache.c(1)'
    );
  });
});

// Note: The following functions require complex bundle patterns that match
// real Claude Code bundle structure. They are tested indirectly via integration
// tests with actual bundle samples:
// - findSelectComponentName (requires .createElement with "Yes, use recommended settings")
// - findDividerComponentName (requires function with specific destructured params)
// - getMainAppComponentBodyStart (requires full component signature with 30+ props)
// - getAppStateSelectorAndUseState (requires useSyncExternalStore pattern)
// - writeToolFetchingUseMemo (requires tool aggregation pattern)
// - findTopLevelPositionBeforeSlashCommand (requires slash command array)
// - writeToolsetComponentDefinition (combines all above)
// - writeToolsets (main orchestrator)
