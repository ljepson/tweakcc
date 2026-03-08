import { describe, expect, it } from 'vitest';

import { writeThemes } from './themes';

const makeThemeSnippet = () =>
  'WH.id==="theme"?t$.createElement(E,{color:FH?"suggestion":void 0},(()=>{return{auto:"Auto (follow system)",dark:"Dark mode",light:"Light mode","dark-daltonized":"Dark mode (colorblind-friendly)","light-daltonized":"Light mode (colorblind-friendly)","dark-ansi":"Dark mode (ANSI colors only)","light-ansi":"Light mode (ANSI colors only)"}[WH.value.toString()]||WH.value.toString()})()):WH.id==="notifChannel"?t$.createElement(E,null,"other");' +
  'function jkH(H){let $=JDf.c(59);ZA("theme:toggleSyntaxHighlighting",b,g);let U=f6(Y?yfq:void 0),u;if($[7]===Symbol.for("react.memo_cache_sentinel"))u=[...[],{label:"Dark mode",value:"dark"},{label:"Light mode",value:"light"},{label:"Dark mode (colorblind-friendly)",value:"dark-daltonized"},{label:"Light mode (colorblind-friendly)",value:"light-daltonized"},{label:"Dark mode (ANSI colors only)",value:"dark-ansi"},{label:"Light mode (ANSI colors only)",value:"light-ansi"}],$[7]=u;else u=$[7];}' +
  'function MI(H){switch(H){case"light":return cS6;case"light-ansi":return QS6;case"dark-ansi":return lS6;case"light-daltonized":return nS6;case"dark-daltonized":return rS6;default:return iS6}}' +
  'function unrelated(){return{name:"AutoHotkey",aliases:["ahk"]}}';

describe('writeThemes', () => {
  it('patches the theme label map inside the theme setting display', () => {
    const code = makeThemeSnippet();
    const result = writeThemes(code, [
      { id: 'dark', name: 'Night', colors: { text: '#000' } as never },
      { id: 'light', name: 'Day', colors: { text: '#fff' } as never },
    ]);

    expect(result).not.toBeNull();
    expect(result).toContain('return{"dark":"Night","light":"Day"}');
  });

  it('does not replace unrelated return objects elsewhere in the bundle', () => {
    const code = makeThemeSnippet();
    const result = writeThemes(code, [
      { id: 'dark', name: 'Night', colors: { text: '#000' } as never },
      { id: 'light', name: 'Day', colors: { text: '#fff' } as never },
    ]);

    expect(result).not.toBeNull();
    expect(result).toContain('return{name:"AutoHotkey",aliases:["ahk"]}');
  });
});
