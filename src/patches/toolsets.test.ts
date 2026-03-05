import { describe, it, expect } from 'vitest';
import {
  findModeChangeSetState,
  writeModeChangeUpdateToolset,
} from './toolsets';

// Simulated minified mode-change code from cli.js.
// The critical pattern is the setState call inside a comma-expression:
//   if(setState(prev=>({...prev,toolPermissionContext:{...ctx,mode:modeVar}})),otherCall(),flag) guard();
const makeModeChangeCode = () =>
  `if(OH==="plan")EA((lA)=>({...lA,lastPlanModeUse:Date.now()}));` +
  `if(cH((lA)=>({...lA,toolPermissionContext:{...n$,mode:OH}})),L({...n$,mode:OH}),fBD(OH,RH?.teamName),fH)MH(!1)`;

describe('findModeChangeSetState', () => {
  it('should find the setState call with correct captures', () => {
    const code = makeModeChangeCode();
    const result = findModeChangeSetState(code);

    expect(result).not.toBeNull();
    expect(result!.setStateVar).toBe('cH');
    expect(result!.prevVar).toBe('lA');
    expect(result!.contextVar).toBe('n$');
    expect(result!.modeVar).toBe('OH');
    expect(result!.fullMatch).toBe(
      'cH((lA)=>({...lA,toolPermissionContext:{...n$,mode:OH}}))'
    );
  });

  it('should work with different minified variable names', () => {
    const code =
      'if(x7((p)=>({...p,toolPermissionContext:{...ctx,mode:m}})),L(),f)g()';
    const result = findModeChangeSetState(code);

    expect(result).not.toBeNull();
    expect(result!.setStateVar).toBe('x7');
    expect(result!.prevVar).toBe('p');
    expect(result!.contextVar).toBe('ctx');
    expect(result!.modeVar).toBe('m');
  });

  it('should return null when pattern is not found', () => {
    const result = findModeChangeSetState('no matching code here');
    expect(result).toBeNull();
  });
});

describe('writeModeChangeUpdateToolset', () => {
  it('should produce a single setState call (no double-setState)', () => {
    const code = makeModeChangeCode();
    const result = writeModeChangeUpdateToolset(code, 'PLAN', 'DEFAULT');

    expect(result).not.toBeNull();

    // The patched code must NOT have two consecutive setState calls.
    // The old bug: cH(prev=>({...prev,toolset:...})); if(cH(prev=>({...prev,toolPermissionContext:...}))
    // Count how many times setState (cH) is called - should be exactly the same
    // number as the original (the single call inside the if-expression).
    const originalSetStateCalls = (code.match(/cH\(/g) || []).length;
    const patchedSetStateCalls = (result!.match(/cH\(/g) || []).length;
    expect(patchedSetStateCalls).toBe(originalSetStateCalls);
  });

  it('should include toolset in the combined setState call', () => {
    const code = makeModeChangeCode();
    const result = writeModeChangeUpdateToolset(code, 'PLAN', 'DEFAULT');

    expect(result).not.toBeNull();
    expect(result).toContain('toolset:');
    expect(result).toContain('"PLAN"');
    expect(result).toContain('"DEFAULT"');
  });

  it('should use a ternary based on the mode variable', () => {
    const code = makeModeChangeCode();
    const result = writeModeChangeUpdateToolset(code, 'PLAN', 'DEFAULT');

    expect(result).not.toBeNull();
    // Should contain: OH==="plan"?"PLAN":"DEFAULT"
    expect(result).toContain('OH==="plan"?"PLAN":"DEFAULT"');
  });

  it('should preserve the surrounding if-expression structure', () => {
    const code = makeModeChangeCode();
    const result = writeModeChangeUpdateToolset(code, 'PLAN', 'DEFAULT');

    expect(result).not.toBeNull();
    // The if(...) comma-expression structure must remain intact:
    // if(cH(...),L(...),fBD(...),fH)MH(!1)
    expect(result).toContain(
      ',L({...n$,mode:OH}),fBD(OH,RH?.teamName),fH)MH(!1)'
    );
  });

  it('should keep toolPermissionContext in the same setState call', () => {
    const code = makeModeChangeCode();
    const result = writeModeChangeUpdateToolset(code, 'SUDO', 'SUDO');

    expect(result).not.toBeNull();
    // Both toolset and toolPermissionContext must be in the same setState updater
    expect(result).toMatch(
      /cH\(\(lA\)=>\(\{\.\.\.lA,toolset:.*,toolPermissionContext:\{\.\.\.n\$,mode:OH\}\}\)\)/
    );
  });

  it('should handle same toolset for plan and default without extra setState', () => {
    const code = makeModeChangeCode();
    const result = writeModeChangeUpdateToolset(code, 'SUDO', 'SUDO');

    expect(result).not.toBeNull();
    // Even when both toolsets are the same, there should still be only the
    // original number of setState calls (no extra one prepended)
    const originalSetStateCalls = (code.match(/cH\(/g) || []).length;
    const patchedSetStateCalls = (result!.match(/cH\(/g) || []).length;
    expect(patchedSetStateCalls).toBe(originalSetStateCalls);
  });

  it('should return null when mode change pattern is not found', () => {
    const result = writeModeChangeUpdateToolset(
      'no matching code',
      'PLAN',
      'DEFAULT'
    );
    expect(result).toBeNull();
  });
});
