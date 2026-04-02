import { describe, expect, it, vi } from 'vitest';
import { writeEngramMemoryBridge } from './engramMemoryBridge';

const mockAutoMemSnippet =
  'function uF$(H){return async($,q)=>{if($.name===eJ)return{behavior:"allow",updatedInput:q};if($.name===Iq||$.name===i4||$.name===e9)return{behavior:"allow",updatedInput:q};if($.name===zq){let K=$.inputSchema.safeParse(q);if(K.success&&$.isReadOnly(K.data))return{behavior:"allow",updatedInput:q};return $_7($,"Only read-only shell commands are permitted in this context (ls, find, grep, cat, stat, wc, head, tail, and similar)")}if(($.name===MK||$.name===H_)&&"file_path" in q){let K=q.file_path;if(typeof K==="string"&&Y8H(K))return{behavior:"allow",updatedInput:q}}return $_7($,`only ${Iq}, ${i4}, ${e9}, read-only ${zq}, and ${MK}/${H_} within ${H} are allowed`)}}' +
  'return[`You are now acting as the memory extraction subagent. Analyze the most recent ~${H} messages above and use them to update your persistent memory systems.`,"",`Available tools: ${Iq}, ${i4}, ${e9}, read-only ${zq} (ls/find/cat/stat/wc/head/tail and similar), and ${MK}/${H_} for paths inside the memory directory only. ${zq} rm is not permitted. All other tools \\u2014 MCP, Agent, write-capable ${zq}, etc \\u2014 will be denied.`,""].join(`' +
  'async function z(O,Y){if(O.toolUseContext.agentId)return;if(!u("tengu_passport_quail",!1))return;if(!n4())return;if(A_())return;if(K){}}';

describe('engramMemoryBridge', () => {
  it('allows structured Engram store calls in the auto-memory sandbox', () => {
    const result = writeEngramMemoryBridge(mockAutoMemSnippet);

    expect(result).not.toBeNull();
    expect(result).toContain('$.name==="mcp__engram__engram_store"');
    expect(result).toContain(
      't==="decision"||t==="discovery"||t==="lesson"||t==="diagnostic"'
    );
    expect(result).toContain('Only structured Engram saves are allowed');
    expect(result).toContain('and mcp__engram__engram_store are allowed');
  });

  it('updates the extractor prompt to mention Engram store', () => {
    const result = writeEngramMemoryBridge(mockAutoMemSnippet);

    expect(result).not.toBeNull();
    expect(result).toContain(
      'mcp__engram__engram_store is also allowed for structured decision/discovery/lesson/diagnostic memories from the recent messages.'
    );
  });

  it('gates extraction on a connected engram MCP client', () => {
    const result = writeEngramMemoryBridge(mockAutoMemSnippet);

    expect(result).not.toBeNull();
    expect(result).toContain(
      'let w=O.toolUseContext.getAppState().mcp.clients;if(!w.some(c=>c.name==="engram"&&c.type==="connected"))return;'
    );
  });

  it('returns null when the auto-memory gate is absent', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = writeEngramMemoryBridge('function nope(){}');
    expect(result).toBeNull();
    vi.restoreAllMocks();
  });
});
