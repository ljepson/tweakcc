import { describe, expect, it, vi } from 'vitest';
import { writeSessionMemory } from './sessionMemory';

// CC <2.1.38 bundle mock with old coral_fern pattern
const mockBundleOld = `
function l28(){return $_("tengu_session_memory",!1)}
if(!$_("tengu_coral_fern",!1))return null;
let config={minimumMessageTokensToInit:1e4,minimumTokensBetweenUpdate:5000,toolCallsBetweenUpdates:3};
=2000=12000# Session Title
`;

// CC >=2.1.38 bundle mock with new coral_fern pattern
const mockBundleNew = `
function l28(){return $_("tengu_session_memory",!1)}
if($_("tengu_coral_fern",!1)){let M=wX(YL());E.push("## Searching past context")}
let config={minimumMessageTokensToInit:1e4,minimumTokensBetweenUpdate:5000,toolCallsBetweenUpdates:3};
=2000=12000# Session Title
`;

// CC >=2.1.69 bundle mock (negative guard returns array)
const mockBundle69 = `
function l28(){return $_("tengu_session_memory",!1)}
if(!$_("tengu_coral_fern",!1))return[];
let config={minimumMessageTokensToInit:1e4,minimumTokensBetweenUpdate:5000,toolCallsBetweenUpdates:3};
=2000=12000# Session Title
`;

describe('writeSessionMemory', () => {
  describe('extraction patch', () => {
    it('should bypass tengu_session_memory flag check', () => {
      const result = writeSessionMemory(mockBundleOld);
      expect(result).toContain('return true;');
    });

    it('should return null if extraction gate not found', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = writeSessionMemory('no matching pattern here');
      expect(result).toBeNull();
      vi.restoreAllMocks();
    });
  });

  describe('past sessions patch', () => {
    it('should patch new pattern (CC >=2.1.38) with if(true)', () => {
      const result = writeSessionMemory(mockBundleNew);
      expect(result).toContain('if(true){');
      expect(result).not.toContain('tengu_coral_fern');
    });

    it('should patch old pattern (CC <=2.1.37) by removing the guard', () => {
      const result = writeSessionMemory(mockBundleOld);
      expect(result).not.toContain('if(!$_("tengu_coral_fern"');
    });

    it('should patch CC >=2.1.69 pattern (return []) by removing the guard', () => {
      const result = writeSessionMemory(mockBundle69);
      expect(result).not.toContain('if(!$_("tengu_coral_fern"');
    });
  });

  describe('token limits patch', () => {
    it('should make per-section tokens configurable via env var', () => {
      const result = writeSessionMemory(mockBundleOld);
      expect(result).toContain('CC_SM_PER_SECTION_TOKENS');
      expect(result).toContain('process.env');
    });

    it('should make total file limit configurable via env var', () => {
      const result = writeSessionMemory(mockBundleOld);
      expect(result).toContain('CM_SM_TOTAL_FILE_LIMIT');
    });
  });

  describe('update thresholds patch', () => {
    it('should make minimumMessageTokensToInit configurable', () => {
      const result = writeSessionMemory(mockBundleOld);
      expect(result).toContain('CC_SM_MINIMUM_MESSAGE_TOKENS_TO_INIT');
    });

    it('should make minimumTokensBetweenUpdate configurable', () => {
      const result = writeSessionMemory(mockBundleOld);
      expect(result).toContain('CC_SM_MINIMUM_TOKENS_BETWEEN_UPDATE');
    });

    it('should make toolCallsBetweenUpdates configurable', () => {
      const result = writeSessionMemory(mockBundleOld);
      expect(result).toContain('CC_SM_TOOL_CALLS_BETWEEN_UPDATES');
    });
  });

  describe('idempotency', () => {
    it('should return unchanged if already patched (env vars present)', () => {
      const alreadyPatched = mockBundleOld.replace(
        'minimumMessageTokensToInit:1e4',
        'minimumMessageTokensToInit:Number(process.env.CC_SM_MINIMUM_MESSAGE_TOKENS_TO_INIT??1e4)'
      );
      const result = writeSessionMemory(alreadyPatched);
      expect(result).toBe(alreadyPatched);
    });
  });
});
