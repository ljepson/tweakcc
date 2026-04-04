import { describe, expect, it, vi } from 'vitest';
import { writeContextDiagnostics } from './contextDiagnostics';

const mockContextFormatter =
  'function Zq1(H){let{categories:$,totalTokens:q,rawMaxTokens:K,percentage:_,model:f,memoryFiles:A,mcpTools:z,agents:O,skills:aB,messageBreakdown:bC,systemTools:dE,systemPromptSections:fG}=H,hI=`## Context Usage\\n\\n`;' +
  'if(aB&&aB.tokens>0&&aB.skillFrontmatter.length>0){hI+=`### Skills\\n\\n`,hI+=`| Skill | Source | Tokens |\\n`,hI+=`|-------|--------|--------|\\n`;for(let xZ of aB.skillFrontmatter)hI+=`| ${xZ.name} | ${vLH(xZ.source)} | ${t_(xZ.tokens)} |\\n`;hI+=`\\n`}return hI}';

describe('contextDiagnostics', () => {
  it('should expose message breakdown and optional system sections in /context output', () => {
    const result = writeContextDiagnostics(mockContextFormatter);
    expect(result).not.toBeNull();
    expect(result).toContain('### Message Breakdown');
    expect(result).toContain('### System Tools');
    expect(result).toContain('### System Prompt Sections');
    expect(result).toContain('#### Top Tools');
    expect(result).toContain('#### Top Attachments');
    // Verify captured variable names are used (not hardcoded defaults)
    expect(result).toContain('t_(bC.toolCallTokens)');
    expect(result).toContain('if(dE&&dE.length>0)');
    expect(result).toContain('if(fG&&fG.length>0)');
    expect(result).toContain('vLH(xZ.source)');
  });

  it('should no-op when diagnostics are already present', () => {
    const alreadyPatched = mockContextFormatter.replace(
      'return hI}',
      'hI+=`### Message Breakdown\\n\\n`,hI+=`#### Top Tools\\n\\n`;return hI}'
    );
    expect(writeContextDiagnostics(alreadyPatched)).toBe(alreadyPatched);
  });

  it('should return null when the /context formatter tail is missing', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(writeContextDiagnostics('function ca9(H){return H}')).toBeNull();
    vi.restoreAllMocks();
  });
});
