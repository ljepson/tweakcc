import { describe, it, expect } from 'vitest';
import { writeAgentsMd } from './agentsMd';

// Old style (CC <=2.1.62): explicit existsSync/isFile check
const mockFunctionOld =
  'function _t7(A,q){try{let K=x1();' +
  'if(!K.existsSync(A)||!K.statSync(A).isFile())return null;' +
  'let Y=UL9(A).toLowerCase();' +
  'if(Y&&!dL9.has(Y))' +
  'return(I(`Skipping non-text file in @include: ${A}`),null);' +
  'let z=K.readFileSync(A,{encoding:"utf-8"}),' +
  '{content:w,paths:H}=cL9(z);' +
  'return{path:A,type:q,content:w,globs:H};' +
  '}catch(K){' +
  'if(K instanceof Error&&K.message.includes("EACCES"))' +
  'n("tengu_claude_md_permission_error",{is_access_error:1});' +
  '}return null;}';

// New style (CC >=2.1.63): readFileSync with ENOENT/EISDIR catch
const mockFunctionNew =
  'function c_A(H,$){try{' +
  'let L=L$().readFileSync(H,{encoding:"utf-8"}),' +
  'I=DM.extname(H).toLowerCase();' +
  'if(I&&!Nq1.has(I))' +
  'return q(`Skipping non-text file in @include: ${H}`),null;' +
  'let{content:D,paths:B}=Oq1(L);' +
  'return{path:H,type:$,content:D,globs:B};' +
  '}catch(A){let L=A.code;' +
  'if(L==="ENOENT"||L==="EISDIR")return null;' +
  'if(L==="EACCES")' +
  'c("tengu_claude_md_permission_error",{is_access_error:1});' +
  '}return null;}';

const altNames = ['AGENTS.md', 'GEMINI.md', 'QWEN.md'];

describe('agentsMd', () => {
  describe('old style (existsSync/isFile early return)', () => {
    it('should inject fallback at early return null', () => {
      const result = writeAgentsMd(mockFunctionOld, altNames);
      expect(result).not.toBeNull();
      expect(result).toContain('didReroute');
      expect(result).toContain('endsWith("/CLAUDE.md")');
      expect(result).toContain('AGENTS.md');
      expect(result).toMatch(/\.isFile\(\)\)\{.*?return null;\}/);
    });

    it('should pass didReroute=true in recursive calls', () => {
      const result = writeAgentsMd(mockFunctionOld, altNames)!;
      expect(result).toContain('return _t7(altPath,q,true)');
    });

    it('should add didReroute parameter to function signature', () => {
      const result = writeAgentsMd(mockFunctionOld, altNames)!;
      expect(result).toContain('function _t7(A,q,didReroute)');
    });

    it('should use the correct fs expression', () => {
      const result = writeAgentsMd(mockFunctionOld, altNames)!;
      expect(result).toContain('K.existsSync(altPath)');
      expect(result).toContain('K.statSync(altPath)');
    });
  });

  describe('new style (ENOENT/EISDIR catch)', () => {
    it('should inject fallback at ENOENT catch return null', () => {
      const result = writeAgentsMd(mockFunctionNew, altNames);
      expect(result).not.toBeNull();
      expect(result).toContain('didReroute');
      expect(result).toContain('endsWith("/CLAUDE.md")');
      expect(result).toContain('AGENTS.md');
    });

    it('should add didReroute parameter to function signature', () => {
      const result = writeAgentsMd(mockFunctionNew, altNames)!;
      expect(result).toContain('function c_A(H,$,didReroute)');
    });

    it('should pass didReroute=true in recursive calls', () => {
      const result = writeAgentsMd(mockFunctionNew, altNames)!;
      expect(result).toContain('return c_A(altPath,$,true)');
    });

    it('should use L$() fs expression for existsSync/statSync', () => {
      const result = writeAgentsMd(mockFunctionNew, altNames)!;
      expect(result).toContain('_fs=L$()');
      expect(result).toContain('_fs.existsSync(altPath)');
      expect(result).toContain('_fs.statSync(altPath)');
    });

    it('should preserve the original ENOENT/EISDIR condition', () => {
      const result = writeAgentsMd(mockFunctionNew, altNames)!;
      expect(result).toContain('"ENOENT"');
      expect(result).toContain('"EISDIR"');
    });

    it('should still return null after fallback exhausted', () => {
      const result = writeAgentsMd(mockFunctionNew, altNames)!;
      expect(result).toContain('}return null;}');
    });
  });

  describe('shared behavior', () => {
    it('should preserve CLAUDE.md content when present', () => {
      for (const mock of [mockFunctionOld, mockFunctionNew]) {
        const result = writeAgentsMd(mock, altNames)!;
        const returnIdx = result.indexOf('return{path:');
        expect(returnIdx).toBeGreaterThan(-1);
      }
    });

    it('should return null when function pattern is not found', () => {
      const result = writeAgentsMd('not a valid file', altNames);
      expect(result).toBeNull();
    });
  });
});
