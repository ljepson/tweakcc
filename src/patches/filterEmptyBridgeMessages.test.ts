import { describe, expect, it, vi } from 'vitest';
import { writeFilterEmptyBridgeMessages } from './filterEmptyBridgeMessages';

const mockBridgeSnippet =
  'async function z(){}function N(H){return H}let q={onInboundMessage(NH){let MH=fa$(NH);if(!MH)return;let{content:kH,uuid:CH}=MH,tH=void 0;_M({value:kH,mode:"prompt",uuid:CH,skipSlashCommands:!0,...tH&&{origin:{kind:"peer",from:tH},isMeta:!0}}),JH()},onPermissionResponse(NH){H.injectControlResponse(NH)}}';

describe('filterEmptyBridgeMessages', () => {
  it('drops blank inbound bridge messages before enqueue', () => {
    const result = writeFilterEmptyBridgeMessages(mockBridgeSnippet);

    expect(result).not.toBeNull();
    expect(result).toContain('if(typeof kH!=="string"||kH.trim()==="")return;');
    expect(result).toContain(
      '_M({value:kH,mode:"prompt",uuid:CH,skipSlashCommands:!0'
    );
  });

  it('returns unchanged when already patched', () => {
    const alreadyPatched = mockBridgeSnippet.replace(
      'let{content:kH,uuid:CH}=MH,tH=void 0;',
      'let{content:kH,uuid:CH}=MH,tH=void 0;if(typeof kH!=="string"||kH.trim()==="")return;'
    );

    expect(writeFilterEmptyBridgeMessages(alreadyPatched)).toBe(alreadyPatched);
  });

  it('returns null when the inbound bridge handler is absent', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(writeFilterEmptyBridgeMessages('function nope(){}')).toBeNull();
    vi.restoreAllMocks();
  });
});
