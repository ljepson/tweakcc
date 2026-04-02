import { describe, expect, it, vi } from 'vitest';
import { writeContextDiagnostics } from './contextDiagnostics';

const mockContextFormatter =
  'function ca9(H){let{categories:$,totalTokens:q,rawMaxTokens:K,percentage:_,model:f,memoryFiles:A,mcpTools:z,agents:O,skills:Y,messageBreakdown:w,systemTools:M,systemPromptSections:D}=H,j=`## Context Usage\\n\\n`;' +
  'if(Y&&Y.tokens>0&&Y.skillFrontmatter.length>0){j+=`### Skills\\n\\n`,j+=`| Skill | Source | Tokens |\\n`,j+=`|-------|--------|--------|\\n`;for(let J of Y.skillFrontmatter)j+=`| ${J.name} | ${NXH(J.source)} | ${O4(J.tokens)} |\\n`;j+=`\\n`}return j}';

describe('contextDiagnostics', () => {
  it('should expose message breakdown and optional system sections in /context output', () => {
    const result = writeContextDiagnostics(mockContextFormatter);
    expect(result).not.toBeNull();
    expect(result).toContain('### Message Breakdown');
    expect(result).toContain('### System Tools');
    expect(result).toContain('### System Prompt Sections');
    expect(result).toContain('#### Top Tools');
    expect(result).toContain('#### Top Attachments');
  });

  it('should no-op when diagnostics are already present', () => {
    const alreadyPatched = mockContextFormatter.replace(
      'return j}',
      'j+=`### Message Breakdown\\n\\n`,j+=`#### Top Tools\\n\\n`;return j}'
    );
    expect(writeContextDiagnostics(alreadyPatched)).toBe(alreadyPatched);
  });

  it('should return null when the /context formatter tail is missing', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(writeContextDiagnostics('function ca9(H){return H}')).toBeNull();
    vi.restoreAllMocks();
  });
});
