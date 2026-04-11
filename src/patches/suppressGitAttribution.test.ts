import { describe, expect, it, vi } from 'vitest';

import { writeSuppressGitAttribution } from './suppressGitAttribution';

describe('suppressGitAttribution', () => {
  it('removes commit and PR attribution output', () => {
    const input =
      'function x(){let _="Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>",K="🤖 Generated with [Claude Code](https://claude.ai/code)";if(f.includeCoAuthoredBy===!1)return{commit:"",pr:""};return{commit:_,pr:K}}';

    const result = writeSuppressGitAttribution(input);

    expect(result).toContain(';return{commit:"",pr:""}');
    expect(result).not.toContain('return{commit:_,pr:K}');
  });

  it('returns null when the attribution block is absent', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(writeSuppressGitAttribution('function nope(){}')).toBeNull();
  });
});
