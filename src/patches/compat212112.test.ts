import { describe, expect, it } from 'vitest';

import { DEFAULT_SETTINGS } from '../defaultSettings';
import { writeMicrocompactFallback } from './microcompactFallback';
import { writeOpusplan1m } from './opusplan1m';
import { findSlashCommandListEndPosition } from './slashCommands';
import { writeSuppressLineNumbers } from './suppressLineNumbers';
import { writeThemes } from './themes';
import { writeThinkerFormat } from './thinkerFormat';
import { writeVerboseProperty } from './verboseProperty';

describe('2.1.112 compatibility', () => {
  it('patches the current verbose spinner prop shape', () => {
    const input =
      'return Iq.createElement(_oK,{mode:H,reducedMotion:j,hasActiveTools:w,responseLengthRef:_,message:g,messageColor:OH,shimmerColor:HH,overrideColor:A,loadingStartTimeRef:$,totalPausedMsRef:q,pauseStartTimeRef:K,spinnerSuffix:Y,verbose:O,columns:E,hasRunningTeammates:qH})';

    const result = writeVerboseProperty(input);

    expect(result).not.toBeNull();
    expect(result).toContain('verbose:true');
    expect(result).not.toContain('verbose:O');
  });

  it('patches the current thinker formatter shape', () => {
    const input =
      'let B=I?.find((XH)=>XH.status!=="pending"&&XH.status!=="completed"),p=$U9(I),[S]=px.useState(()=>aD(VMH())),F=z??B?.activeForm??B?.subject??S,g=(V&&!V.isIdle?V.spinnerVerb??S:F)+"\\u2026";';

    const result = writeThinkerFormat(input, '{} -> ready');

    expect(result).not.toBeNull();
    expect(result).toContain('=`${V&&!V.isIdle?V.spinnerVerb??S:F} -> ready`');
  });

  it('patches the current theme option list shape', () => {
    const input =
      'function u2(H){switch(H){case"light":return Zc4;case"light-ansi":return vc4;case"dark-ansi":return Tc4;case"light-daltonized":return kc4;case"dark-daltonized":return Nc4;default:return Vc4}}var XO1={auto:"Auto (match terminal)",dark:"Dark mode",light:"Light mode","dark-daltonized":"Dark mode (colorblind-friendly)","light-daltonized":"Light mode (colorblind-friendly)","dark-ansi":"Dark mode (ANSI colors only)","light-ansi":"Light mode (ANSI colors only)"};let S=[{label:"Auto (match terminal)",value:"auto"},{label:"Dark mode",value:"dark"},{label:"Light mode",value:"light"},{label:"Dark mode (colorblind-friendly)",value:"dark-daltonized"},{label:"Light mode (colorblind-friendly)",value:"light-daltonized"},{label:"Dark mode (ANSI colors only)",value:"dark-ansi"},{label:"Light mode (ANSI colors only)",value:"light-ansi"}];';

    const result = writeThemes(input, [
      {
        id: 'sunrise',
        name: 'Sunrise',
        colors: DEFAULT_SETTINGS.themes[0].colors,
      },
    ]);

    expect(result).not.toBeNull();
    expect(result).toContain('[{"label":"Sunrise","value":"sunrise"}]');
    expect(result).toContain('XO1={"sunrise":"Sunrise"}');
    expect(result).toContain('case"sunrise":return');
  });

  it('patches the current line number formatter helper', () => {
    const input =
      'function eR6(H,$,q){let K=H.endsWith("\\r")?H.slice(0,-1):H;if(q)return`${$}\t${K}`;let _=String($);return _.length>=6?`${_}→${K}`:`${_.padStart(6," ")}→${K}` }';

    const result = writeSuppressLineNumbers(input);

    expect(result).not.toBeNull();
    expect(result).toContain('return K');
  });

  it('patches opusplan descriptions in the current wording', () => {
    const input =
      'if(CC()==="opusplan"&&$==="plan"&&!K)return RN();let x=["sonnet","opus","haiku","best","sonnet[1m]","opus[1m]","opusplan"];function _lH(H){if(H==="opusplan")return"Opus in plan mode, else Sonnet";return yD(q_(H))}function AlH(H){if(H==="opusplan")return"Opus Plan";if(er(H))return T0(H);return yD(H)}if(_==="opusplan")return _JH([...$,vH1()]);if(_===null||$.some((z)=>z.value===_))return _JH($);';

    const result = writeOpusplan1m(input);

    expect(result).not.toBeNull();
    expect(result).toContain('opusplan[1m]');
    expect(result).toContain(
      'if(H==="opusplan[1m]")return"Opus in plan mode, else Sonnet (1M context)";'
    );
  });

  it('finds the current slash command array shape', () => {
    const input =
      'var a,b;eY6=j8(()=>[n9K,Jm7,Ux7,Lb7,NP7,su7,Sa$,f56,xa$,TG7,O56,y27,FG7,e56,Ks$,YZ7,OA6,Lp7,X1$,OC7,Pe$,Wp7,fu7,LA6,I07,C07,U07,gv7,lv7,Gk7,H07,Uf6,_07,im7,$p7,lx7,af6,zY6,jE7,_S7,OS7,JS7,q36,_I7,gY6,YI7,Op7,$m7,N36,NR7,e16,et$,lS7,BS7,ex7,YR7,T36,mm7,O5H,z9H,TeK,zp7,V36,Ny1]),IF=j8(()=>new Set(eY6().flatMap((H)=>[H.name,...H.aliases??[]])));var c=1;';

    const result = findSlashCommandListEndPosition(input);

    expect(result).not.toBeNull();
    expect(input[result!]).toBe(']');
  });

  it('treats the current microcompact fallback shape as already supported', () => {
    const input =
      'function aS1(H){if(!H.includeFirstPartyBetas)return null;if(!H.querySource.startsWith("repl_main_thread"))return null;let $=dg7(),q=!1,K=!1,_=!1;return{active:$,logThinkingClearLatched:fw6,buildRequestParams(){if(K=!1,!$||q)return null;return K=!0,{betaHeader:Ug7,body:{context_hint:{enabled:!0}}}},onRequestError(A,f){if(!K||q)return null;return null},classifyStreamError(A){return!1},onStreamFallback(A,f){return null},strip(){q=!0}}}var oS1=5,ag7;function sg7(H,$){let _=FfK(H,$,{keepRecent:oS1});if(!_)CS();return{messages:H}}';

    expect(writeMicrocompactFallback(input)).toBe(input);
  });
});
