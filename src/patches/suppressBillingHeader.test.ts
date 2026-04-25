import { describe, expect, it } from 'vitest';
import { writeSuppressBillingHeader } from './suppressBillingHeader';

describe('writeSuppressBillingHeader', () => {
  it('returns an empty billing attribution header without logging it', () => {
    const input =
      'function hF$(H){if(a4(process.env.CLAUDE_CODE_ATTRIBUTION_HEADER))return"";let Y=`x-anthropic-billing-header: cc_version=${H};`;return E(`attribution header ${Y}`),Y}';

    const result = writeSuppressBillingHeader(input);

    expect(result).toContain('return""');
    expect(result).not.toContain('attribution header');
  });

  it('is a no-op when the billing header is absent', () => {
    const input = 'function other(){return""}';

    const result = writeSuppressBillingHeader(input);

    expect(result).toBe(input);
  });
});
