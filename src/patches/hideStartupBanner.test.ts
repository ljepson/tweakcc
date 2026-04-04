import { describe, expect, it, vi } from 'vitest';
import { writeHideStartupBanner } from './hideStartupBanner';

// Pre-2.1.87: banner rendered as a createElement with isBeforeFirstMessage:!1
// The patch excises the element, leaving only the leading comma.
const oldPatternSnippet =
  'return[X0.createElement(WL,null),X0.createElement(AA,null)' +
  ',R$.createElement(Mn,{isBeforeFirstMessage:!1}),' +
  'X0.createElement(Footer,null)]';

// 2.1.92-era: extracted from the real bundle around function Ut$()
// Uses FO6.c() as the React Compiler memo hook (method name is .c).
const newPatternSnippet =
  'function Ut$(){let H=FO6.c(35),[$]=Mq();' +
  'if(w6.terminal==="Apple_Terminal"){let W;' +
  'if(H[0]!==$)W=f6.default.createElement(pE1,{theme:$,welcomeMessage:"Welcome to Claude Code"}),' +
  'H[0]=$,H[1]=W;else W=H[1];return W}' +
  'if(["light","light-daltonized","light-ansi"].includes($)){return null}}';

// Same structure but with a $-prefixed function name (common in minified CC bundles).
const newPatternDollarName =
  'function $Ut(){let H=FO6.c(35),[$]=Mq();' +
  'if(w6.terminal==="Apple_Terminal"){let W;' +
  'if(H[0]!==$)W=f6.default.createElement(pE1,{theme:$,welcomeMessage:"Welcome to Claude Code"}),' +
  'H[0]=$,H[1]=W;else W=H[1];return W}' +
  'if(["light","light-daltonized","light-ansi"].includes($)){return null}}';

// Alternate memo hook method name — pattern uses .[$\w]+ so it must match .use(), .memo(), etc.
const newPatternAltHook =
  'function Ut$(){let H=FO6.use(35),[$]=Mq();' +
  'if(w6.terminal==="Apple_Terminal"){let W;' +
  'if(H[0]!==$)W=f6.default.createElement(pE1,{theme:$,welcomeMessage:"Welcome to Claude Code"}),' +
  'H[0]=$,H[1]=W;else W=H[1];return W}' +
  'if(["light","light-daltonized","light-ansi"].includes($)){return null}}';

// Already-patched variant (return null; injected at function body start).
const alreadyPatchedSnippet =
  'function Ut$(){return null;let H=FO6.c(35),[$]=Mq();' +
  'if(w6.terminal==="Apple_Terminal"){let W;' +
  'if(H[0]!==$)W=f6.default.createElement(pE1,{theme:$,welcomeMessage:"Welcome to Claude Code"}),' +
  'H[0]=$,H[1]=W;else W=H[1];return W}' +
  'if(["light","light-daltonized","light-ansi"].includes($)){return null}}';

describe('hideStartupBanner', () => {
  describe('pre-2.1.87 pattern (isBeforeFirstMessage:!1)', () => {
    it('removes the banner createElement call', () => {
      const result = writeHideStartupBanner(oldPatternSnippet);
      expect(result).not.toBeNull();
      expect(result).not.toContain('isBeforeFirstMessage:!1');
    });

    it('preserves surrounding content with a single comma replacement', () => {
      const result = writeHideStartupBanner(oldPatternSnippet);
      expect(result).not.toBeNull();
      // The removed element is replaced by a bare comma — the array stays valid.
      expect(result).toContain(',X0.createElement(Footer,null)]');
      expect(result).toContain('X0.createElement(AA,null),');
    });
  });

  describe('2.1.87+ pattern (Apple_Terminal + Welcome to Claude Code)', () => {
    it('injects return null at the function body start', () => {
      const result = writeHideStartupBanner(newPatternSnippet);
      expect(result).not.toBeNull();
      expect(result).toMatch(/^function Ut\$\(\)\{return null;/);
    });

    it('does not duplicate the function signature', () => {
      const result = writeHideStartupBanner(newPatternSnippet);
      expect(result).not.toBeNull();
      const matches = (result ?? '').match(/function Ut\$/g);
      expect(matches).toHaveLength(1);
    });

    it('works with a $-prefixed function name', () => {
      const result = writeHideStartupBanner(newPatternDollarName);
      expect(result).not.toBeNull();
      expect(result).toMatch(/^function \$Ut\(\)\{return null;/);
    });

    it('matches when the memo hook uses a method other than .c()', () => {
      const result = writeHideStartupBanner(newPatternAltHook);
      expect(result).not.toBeNull();
      expect(result).toMatch(/^function Ut\$\(\)\{return null;/);
    });
  });

  describe('idempotency', () => {
    it('returns null on an already-patched bundle', () => {
      // Once `return null;` is injected the regex no longer matches: the
      // pattern requires `let <id>=<id>.<method>(<n>)` immediately after
      // the opening brace, but the injection sits there instead.  The
      // patch correctly becomes a no-op on double-apply.
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = writeHideStartupBanner(alreadyPatchedSnippet);
      expect(result).toBeNull();
      vi.restoreAllMocks();
    });
  });

  describe('no-match behaviour', () => {
    it('returns null when neither pattern is present', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      expect(
        writeHideStartupBanner('function unrelated(){return 42}')
      ).toBeNull();
      vi.restoreAllMocks();
    });
  });
});
