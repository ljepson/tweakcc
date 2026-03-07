import { describe, expect, it } from 'vitest';

import { writeTokenCountRounding } from './tokenCountRounding';

const makeTokenSnippet = () =>
  'let e=n.current,t=Math.round(e/4),_H=O?Math.max(v,J):v,JH=E6(_H),IH=pA(JH),$H=j&&!j.isIdle?j.progress?.tokenCount??0:t+X,DH=Z6($H),wH=O?`${DH} tokens`:`${eH.arrowDown} ${DH} tokens`,fH=pA(wH),vH=W==="thinking"?`thinking${G}`:typeof W==="number"?`thought for ${Math.max(1,Math.round(W/1000))}s`:null,XH=vH?pA(vH):0,HH=g+2,AH=XV1,LH=W!==null,s=P||O||_H>jV1,o=Y-HH-5,OH=LH&&o>XH;if(!OH&&LH&&W==="thinking"&&G){if(o>GED)vH="thinking",XH=GED,OH=!0}let qH=OH?XH+AH:0,YH=s&&o>qH+IH,VH=qH+(YH?IH+AH:0),hH=s&&$H>0&&o>VH+fH,CH=OH&&W==="thinking"&&!z&&!YH&&!hH,WH=(T-EED)/1000,PH=T<EED?0:(Math.sin(WH*Math.PI*2/WV1)+1)/2,EH=WV(Rb(JV1,IV1,PH)),FH=[...hH?[x9.createElement(B,{flexDirection:"row",key:"tokens"},!O&&x9.createElement(GV1,{mode:H}),x9.createElement(E,{dimColor:!0},DH," tokens"))]:[]];';

describe('writeTokenCountRounding', () => {
  it('patches only the formatter assignment for the displayed token count', () => {
    const code = makeTokenSnippet();
    const result = writeTokenCountRounding(code, 10);

    expect(result).not.toBeNull();
    expect(result).toContain('DH=Z6(Math.round(($H)/10)*10),wH=');
  });

  it('does not swallow the surrounding JSX token display logic', () => {
    const code = makeTokenSnippet();
    const result = writeTokenCountRounding(code, 10);

    expect(result).not.toBeNull();
    expect(result).toContain('x9.createElement(E,{dimColor:!0},DH," tokens")');
    expect(result).toContain('let qH=OH?XH+AH:0');
  });
});
