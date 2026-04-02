import { describe, expect, it, vi } from 'vitest';
import { writePlanModeInterview } from './planModeInterview';

const mockPlanModeInterview =
  'function rO(){let H=process.env.CLAUDE_CODE_PLAN_MODE_INTERVIEW_PHASE;' +
  'if(lH(H))return!0;' +
  'if(V9(H))return!1;' +
  'return B$("tengu_plan_mode_interview_phase",!1)}' +
  'function BF$(){return null}';

describe('planModeInterview', () => {
  it('should force the interview gate on', () => {
    const result = writePlanModeInterview(mockPlanModeInterview);
    expect(result).not.toBeNull();
    expect(result).toContain('function rO(){return!0}');
    expect(result).not.toContain('tengu_plan_mode_interview_phase');
  });

  it('should no-op when the interview phase is already forced on', () => {
    const alreadyPatched =
      'function Aw(){return!0}function gd$(){let H=u("tengu_pewter_ledger",null);if(H==="trim"||H==="cut"||H==="cap")return H;return null}';

    expect(writePlanModeInterview(alreadyPatched)).toBe(alreadyPatched);
  });

  it('should return null when the interview gate function is not found', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = writePlanModeInterview('function other(){return!1}');
    expect(result).toBeNull();
    vi.restoreAllMocks();
  });
});
