import { describe, expect, it } from 'vitest';
import { writeDisableFastMode } from './disableFastMode';

describe('writeDisableFastMode', () => {
  it('forces the fast mode availability gate off', () => {
    const input =
      'function L4(){if(iq()!=="firstParty")return!1;return!hH(process.env.CLAUDE_CODE_DISABLE_FAST_MODE)}';

    const result = writeDisableFastMode(input);

    expect(result).toBe('function L4(){return!1}');
  });

  it('is a no-op when fast mode is absent', () => {
    const input = 'function other(){return!0}';

    const result = writeDisableFastMode(input);

    expect(result).toBe(input);
  });
});
