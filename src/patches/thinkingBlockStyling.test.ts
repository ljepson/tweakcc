import { describe, expect, it, vi } from 'vitest';
import { writeThinkingBlockStyling } from './thinkingBlockStyling';

// findTextComponent body-destructured pattern (CC 2.1.87+ / 2.1.92).
// This is the minimal prefix required for findTextComponent to resolve to "T".
const TEXT_COMPONENT_FIXTURE =
  'function T(H){let $=Aoq.c(10),{color:q,backgroundColor:K,dimColor:_,bold:f,italic:A,underline:z,strikethrough:O,inverse:Y,wrap:w,children:M}=H';

// CC 2.1.10-era: param-destructured function, literal ∴ char, Component,null form.
// Taken directly from the CC 2.1.10 comment in thinkingBlockStyling.ts.
const mockSnippet_2_1_10 =
  TEXT_COMPONENT_FIXTURE +
  ';function FkA({param:{thinking:A},addMargin:Q=!1,isTranscriptMode:B,verbose:G,hideInTranscript:Z=!1}=H' +
  '{let x=q9A.default.createElement($,{dimColor:!0,italic:!0},"∴ Thinking…");' +
  'return q9A.default.createElement(j,{paddingLeft:2},q9A.default.createElement($D,null,A))}';

// CC 2.1.20-era: React compiler cache form, \\u2234 escape, \\u2026 escape, Component,null form.
// Derived from the CC 2.1.20 comment in thinkingBlockStyling.ts.
const mockSnippet_2_1_20 =
  TEXT_COMPONENT_FIXTURE +
  ';function Ej1(H){let K=s(17),{param:q,addMargin:Y,isTranscriptMode:z,verbose:w,hideInTranscript:J}=H,{thinking:J}=q,' +
  'O=Y===void 0?!1:Y;let D;if(K[1]!==J)((D="\\u2234 Thinking"),(K[1]=J),(K[2]=D));else D=K[2];' +
  'let M=O?1:0,j;if(K[9]!==D)((j=z3A.default.createElement(f,{dimColor:!0,italic:!0},D,"\\u2026")),(K[9]=D),(K[10]=j));else j=K[10];' +
  'let P;if(K[11]!==J)((P=z3A.default.createElement(I,{paddingLeft:2},z3A.default.createElement(P0,null,J))),(K[11]=J),(K[12]=P));else P=K[12];}';

// Same as 2.1.20 form but with $-prefixed identifiers throughout.
const mockSnippet_dollar =
  TEXT_COMPONENT_FIXTURE +
  ';function $Ej(H){let $K=s(17),{param:$q,addMargin:$Y}=H,{thinking:$z}=$q,' +
  'O=$Y===void 0?!1:$Y;let D;if($K[1]!==$z)((D="\\u2234 Thinking"),($K[1]=$z),($K[2]=D));else D=$K[2];' +
  'let M=O?1:0,j;if($K[9]!==D)((j=z3A.default.createElement($f,{dimColor:!0,italic:!0},D,"\\u2026"))' +
  ',($K[9]=D),($K[10]=j));else j=$K[10];' +
  'let P;if($K[11]!==$z)((P=z3A.default.createElement($I,{paddingLeft:2},z3A.default.createElement($P0,null,$z))),($K[11]=$z),($K[12]=P));else P=$K[12];}';

describe('thinkingBlockStyling', () => {
  it('matches and patches the 2.1.10 form (literal ∴, ,null)', () => {
    const result = writeThinkingBlockStyling(mockSnippet_2_1_10);

    expect(result).not.toBeNull();
    // Original null-prop component is replaced
    expect(result).not.toContain('$D,null');
    // Text component with dimColor+italic injected
    expect(result).toContain('T,{dimColor:true,italic:true}');
    // Thinking variable (A) still present as child
    expect(result).toMatch(
      /createElement\(T,\{dimColor:true,italic:true\},A\)/
    );
  });

  it('matches and patches the 2.1.20 form (\\u2234 escape, \\u2026 escape, ,null)', () => {
    const result = writeThinkingBlockStyling(mockSnippet_2_1_20);

    expect(result).not.toBeNull();
    expect(result).not.toContain('P0,null');
    expect(result).toContain('T,{dimColor:true,italic:true}');
    // Thinking variable (J) still present as child
    expect(result).toMatch(
      /createElement\(T,\{dimColor:true,italic:true\},J\)/
    );
  });

  it('matches $-prefixed identifiers throughout', () => {
    const result = writeThinkingBlockStyling(mockSnippet_dollar);

    expect(result).not.toBeNull();
    expect(result).not.toContain('$P0,null');
    expect(result).toContain('T,{dimColor:true,italic:true}');
    // $-prefixed thinking variable ($z) still present as child
    expect(result).toMatch(
      /createElement\(T,\{dimColor:true,italic:true\},\$z\)/
    );
  });

  it('returns null gracefully when the thinking block pattern is absent', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = writeThinkingBlockStyling(
      TEXT_COMPONENT_FIXTURE + ';function other(){return null}'
    );
    expect(result).toBeNull();
    vi.restoreAllMocks();
  });

  it('returns null gracefully when findTextComponent cannot resolve', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = writeThinkingBlockStyling('function unrelated(){}');
    expect(result).toBeNull();
    vi.restoreAllMocks();
  });

  it('does not mutate content outside the matched span', () => {
    const result = writeThinkingBlockStyling(mockSnippet_2_1_20);

    expect(result).not.toBeNull();
    // Text component fixture prefix is preserved verbatim
    expect(result!.startsWith(TEXT_COMPONENT_FIXTURE)).toBe(true);
    // Content after the match (the closing brace) is preserved
    expect(result!.endsWith('}')).toBe(true);
  });
});
