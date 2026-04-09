import { describe, expect, it, vi } from 'vitest';
import { writeSuppressNoContentPlaceholders } from './suppressNoContentPlaceholders';

const mockNoContentSnippet =
  'var vN="(no content)";function n$({content:H,isMeta:$,isVisibleInTranscriptOnly:q,isVirtual:K,isCompactSummary:_,summarizeMetadata:f,toolUseResult:A,mcpMeta:z,uuid:O,timestamp:Y,imagePasteIds:M,sourceToolAssistantUUID:w,permissionMode:D,origin:j}){return{type:"user",message:{role:"user",content:H||vN},isMeta:$}}' +
  'function O81(H){if(H.length===0)return H;let $=!1,q=H.map((K,_)=>{if(K.type!=="assistant")return K;if(_===H.length-1)return K;let f=K.message.content;if(Array.isArray(f)&&f.length===0)return $=!0,Q("tengu_fixed_empty_assistant_content",{messageUUID:K.uuid,messageIndex:_}),{...K,message:{...K.message,content:[{type:"text",text:vN,citations:[]}]}};return K});return $?q:H}';

describe('suppressNoContentPlaceholders', () => {
  it('preserves empty meta user content instead of injecting no-content', () => {
    const result = writeSuppressNoContentPlaceholders(mockNoContentSnippet);

    expect(result).not.toBeNull();
    expect(result).toContain('content:$?H??"":H||vN');
  });

  it('uses a neutral assistant placeholder instead of literal no-content', () => {
    const result = writeSuppressNoContentPlaceholders(mockNoContentSnippet);

    expect(result).not.toBeNull();
    expect(result).toContain('text:"[No message content]"');
    expect(result).not.toContain('text:vN');
  });

  it('returns null when the expected constructor is absent', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(writeSuppressNoContentPlaceholders('function nope(){}')).toBeNull();
    vi.restoreAllMocks();
  });
});
