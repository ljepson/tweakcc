import { describe, expect, it, vi } from 'vitest';
import { writeSuppressNoContentPlaceholders } from './suppressNoContentPlaceholders';

const mockNoContentSnippet =
  'var vN="(no content)";function n$({content:H,isMeta:$,isVisibleInTranscriptOnly:q,isVirtual:K,isCompactSummary:_,summarizeMetadata:f,toolUseResult:A,mcpMeta:z,uuid:O,timestamp:Y,imagePasteIds:M,sourceToolAssistantUUID:w,permissionMode:D,origin:j}){return{type:"user",message:{role:"user",content:H||vN},isMeta:$}}' +
  'function O81(H){if(H.length===0)return H;let $=!1,q=H.map((K,_)=>{if(K.type!=="assistant")return K;if(_===H.length-1)return K;let f=K.message.content;if(Array.isArray(f)&&f.length===0)return $=!0,Q("tengu_fixed_empty_assistant_content",{messageUUID:K.uuid,messageIndex:_}),{...K,message:{...K.message,content:[{type:"text",text:vN,citations:[]}]}};return K});return $?q:H}' +
  'function ZO7(H){let $=[],q=!1;for(let _=0;_<H.length;_++){let D=H[_+1],G=[];if(D?.type==="user"){let W=[];let v=[...G,...W];if(v.length>0){let k={...D,message:{...D.message,content:v}};_++,$.push(k)}else _++,$.push(n$({content:vN,isMeta:!0}))}}return q?$:H}';

const mockNoContentSnippet92 =
  'var rV="(no content)";function n$({content:H,isMeta:$,isVisibleInTranscriptOnly:q,isVirtual:K,isCompactSummary:_,summarizeMetadata:f,toolUseResult:A,mcpMeta:z,uuid:O,timestamp:Y,imagePasteIds:M,sourceToolAssistantUUID:w,permissionMode:D,origin:j}){return{type:"user",message:{role:"user",content:H||rV},isMeta:$}}' +
  'function Je9(H){if(H.length===0)return H;let $=!1,q=H.map((K,_)=>{if(K.type!=="assistant")return K;if(_===H.length-1)return K;let f=K.message.content;if(Array.isArray(f)&&f.length===0)return $=!0,Q("tengu_fixed_empty_assistant_content",{messageUUID:K.uuid,messageIndex:_}),{...K,message:{...K.message,content:[{type:"text",text:rV,citations:[]}]}};return K});return $?q:H}' +
  'function ZO7(H){let $=[],q=!1;for(let _=0;_<H.length;_++){let D=H[_+1],G=[];if(D?.type==="user"){let W=[];let v=[...G,...W];if(v.length>0){let k={...D,message:{...D.message,content:v}};_++,$.push(k)}else _++,$.push(n$({content:rV,isMeta:!0}))}}return q?$:H}';

const mockNoContentSnippet94 =
  'var vV="(no content)";function n_({content:H,isMeta:_,isVisibleInTranscriptOnly:A,isVirtual:q,isCompactSummary:K,summarizeMetadata:f,toolUseResult:$,mcpMeta:L,uuid:M,timestamp:O,imagePasteIds:D,sourceToolAssistantUUID:z,permissionMode:w,origin:Y}){return{type:"user",message:{role:"user",content:H||vV},isMeta:_}}' +
  'function P94(H){if(H.length===0)return H;let _=!1,A=H.map((q,K)=>{if(q.type!=="assistant")return q;if(K===H.length-1)return q;let f=q.message.content;if(Array.isArray(f)&&f.length===0)return _=!0,Q("tengu_fixed_empty_assistant_content",{messageUUID:q.uuid,messageIndex:K}),{...q,message:{...q.message,content:[{type:"text",text:vV,citations:[]}]}};return q});return _?A:H}' +
  'function R94(H){let _=[],A=!1;for(let q=0;q<H.length;q++){let D=H[q+1],G=[];if(D?.type==="user"){let W=[];let v=[...G,...W];if(v.length>0){let k={...D,message:{...D.message,content:v}};q++,_.push(k)}else q++,_.push(n_({content:vV,isMeta:!0}))}}return A?_:H}';

const mockNoContentSnippet101 =
  'var aN="(no content)";function r$({content:H,isMeta:$,isVisibleInTranscriptOnly:q,isVirtual:K,isCompactSummary:_,summarizeMetadata:A,toolUseResult:f,mcpMeta:z,uuid:O,timestamp:Y,imagePasteIds:D,sourceToolAssistantUUID:M,permissionMode:w,origin:j}){return{type:"user",message:{role:"user",content:H||aN},isMeta:$}}' +
  'function u41(H){let $,q=H.length-1;for(let K=0;K<q;K++){let _=H[K];if(_.type!=="assistant")continue;let A=_.message.content;if(!Array.isArray(A)||A.length>0)continue;if(c("tengu_fixed_empty_assistant_content",{messageUUID:_.uuid,messageIndex:K}),!$)$=H.slice();$[K]={..._,message:{..._.message,content:[{type:"text",text:aN,citations:[]}]}}}return $??H}' +
  'function Jw7(H){let $=[],q=!1;for(let _=0;_<H.length;_++){let A=H[_+1];if(A?.type==="user"){let G=[];if(G.length>0){let W={...A,message:{...A.message,content:G}};_++,$.push(W)}else _++,$.push(r$({content:aN,isMeta:!0}))}}return q?$:H}';

describe('suppressNoContentPlaceholders', () => {
  it('preserves empty meta user content instead of injecting no-content', () => {
    const result = writeSuppressNoContentPlaceholders(mockNoContentSnippet);

    expect(result).not.toBeNull();
    expect(result).toContain('content:H?H??"":H||vN');
  });

  it('uses a neutral assistant placeholder instead of literal no-content', () => {
    const result = writeSuppressNoContentPlaceholders(mockNoContentSnippet);

    expect(result).not.toBeNull();
    expect(result).toContain('text:"[No message content]"');
    expect(result).not.toContain('text:vN');
  });

  it('replaces synthetic meta no-content repair with a neutral sentinel', () => {
    const result = writeSuppressNoContentPlaceholders(mockNoContentSnippet);

    expect(result).not.toBeNull();
    expect(result).toContain(
      'n$({content:"[Synthetic empty meta message]",isMeta:!0})'
    );
    expect(result).not.toContain('n$({content:vN,isMeta:!0})');
  });

  it('matches the 2.1.92 rV-based constructor and repair paths', () => {
    const result = writeSuppressNoContentPlaceholders(mockNoContentSnippet92);

    expect(result).not.toBeNull();
    expect(result).toContain('content:H?H??"":H||rV');
    expect(result).toContain('text:"[No message content]"');
    expect(result).toContain(
      'n$({content:"[Synthetic empty meta message]",isMeta:!0})'
    );
    expect(result).not.toContain('text:rV');
    expect(result).not.toContain('n$({content:rV,isMeta:!0})');
  });

  it('upgrades the older empty synthetic meta repair to the neutral sentinel', () => {
    const result = writeSuppressNoContentPlaceholders(
      mockNoContentSnippet.replace(
        'n$({content:vN,isMeta:!0})',
        'n$({content:"",isMeta:!0})'
      )
    );

    expect(result).not.toBeNull();
    expect(result).toContain(
      'n$({content:"[Synthetic empty meta message]",isMeta:!0})'
    );
    expect(result).not.toContain('n$({content:"",isMeta:!0})');
  });

  it('matches the 2.1.94 vV/n_ constructor and repair paths', () => {
    const result = writeSuppressNoContentPlaceholders(mockNoContentSnippet94);

    expect(result).not.toBeNull();
    expect(result).toContain('content:H?H??"":H||vV');
    expect(result).toContain('text:"[No message content]"');
    expect(result).toContain(
      'n_({content:"[Synthetic empty meta message]",isMeta:!0})'
    );
    expect(result).not.toContain('text:vV');
    expect(result).not.toContain('n_({content:vV,isMeta:!0})');
  });

  it('matches the 2.1.101 aN-based constructor and repair paths', () => {
    const result = writeSuppressNoContentPlaceholders(mockNoContentSnippet101);

    expect(result).not.toBeNull();
    expect(result).toContain('content:H?H??"":H||aN');
    expect(result).toContain('text:"[No message content]"');
    expect(result).toContain(
      'r$({content:"[Synthetic empty meta message]",isMeta:!0})'
    );
    expect(result).not.toContain('text:aN');
    expect(result).not.toContain('r$({content:aN,isMeta:!0})');
  });

  it('returns null when the expected constructor is absent', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(writeSuppressNoContentPlaceholders('function nope(){}')).toBeNull();
    vi.restoreAllMocks();
  });
});
