import { describe, expect, it, vi } from 'vitest';
import {
  writeToolsetFieldToAppState,
  appendToolsetToModeDisplay,
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
