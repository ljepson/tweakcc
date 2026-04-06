import { describe, expect, it, vi } from 'vitest';
import { writeEngramMemoryBridge } from './engramMemoryBridge';

// 2.1.89-era identifiers
const mockAutoMemSnippet_2_1_89 =
  'function uF$(H){return async($,q)=>{if($.name===eJ)return{behavior:"allow",updatedInput:q};if($.name===Iq||$.name===i4||$.name===e9)return{behavior:"allow",updatedInput:q};if($.name===zq){let K=$.inputSchema.safeParse(q);if(K.success&&$.isReadOnly(K.data))return{behavior:"allow",updatedInput:q};return $_7($,"Only read-only shell commands are permitted in this context (ls, find, grep, cat, stat, wc, head, tail, and similar)")}if(($.name===MK||$.name===H_)&&"file_path" in q){let K=q.file_path;if(typeof K==="string"&&Y8H(K))return{behavior:"allow",updatedInput:q}}return $_7($,`only ${Iq}, ${i4}, ${e9}, read-only ${zq}, and ${MK}/${H_} within ${H} are allowed`)}}' +
  'return[`You are now acting as the memory extraction subagent. Analyze the most recent ~${H} messages above and use them to update your persistent memory systems.`,"",`Available tools: ${Iq}, ${i4}, ${e9}, read-only ${zq} (ls/find/cat/stat/wc/head/tail and similar), and ${MK}/${H_} for paths inside the memory directory only. ${zq} rm is not permitted. All other tools \\u2014 MCP, Agent, write-capable ${zq}, etc \\u2014 will be denied.`,""].join(`' +
  'async function z(O,Y){if(O.toolUseContext.agentId)return;if(!u("tengu_passport_quail",!1))return;if(!n4())return;if(A_())return;if(K){}}';

// 2.1.92-era identifiers (function names changed: n4->e4, A_->L_, u->C$)
const mockAutoMemSnippet_2_1_92 =
  'function sc$(H){return async($,q)=>{if($.name===iw)return{behavior:"allow",updatedInput:q};if($.name===Bq||$.name===M9||$.name===G1)return{behavior:"allow",updatedInput:q};if($.name===_q){let K=$.inputSchema.safeParse(q);if(K.success&&$.isReadOnly(K.data))return{behavior:"allow",updatedInput:q};return U$6($,"Only read-only shell commands are permitted in this context (ls, find, grep, cat, stat, wc, head, tail, and similar)")}if(($.name===yK||$.name===g7)&&"file_path"in q){let K=q.file_path;if(typeof K==="string"&&gd(K))return{behavior:"allow",updatedInput:q}}return U$6($,`only ${Bq}, ${M9}, ${G1}, read-only ${_q}, and ${yK}/${g7} within ${H} are allowed`)}}' +
  'return[`You are now acting as the memory extraction subagent. Analyze the most recent ~${H} messages above and use them to update your persistent memory systems.`,"",`Available tools: ${Bq}, ${M9}, ${G1}, read-only ${_q} (ls/find/cat/stat/wc/head/tail and similar), and ${yK}/${g7} for paths inside the memory directory only. ${_q} rm is not permitted. All other tools \\u2014 MCP, Agent, write-capable ${_q}, etc \\u2014 will be denied.`,""].join(`' +
  'async function z(O,Y){if(O.toolUseContext.agentId)return;if(!C$("tengu_passport_quail",!1))return;if(!e4())return;if(L_())return;if(K){}}';

const mockAutoMemSnippet = mockAutoMemSnippet_2_1_89;

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
      'if(!O.toolUseContext.getAppState().mcp.clients.some(c=>c.name==="engram"&&c.type==="connected"))return;'
    );
  });

  it('returns unchanged when the bundle is already patched', () => {
    const alreadyPatched = mockAutoMemSnippet
      .replace(
        'return $_7($,`only ${Iq}, ${i4}, ${e9}, read-only ${zq}, and ${MK}/${H_} within ${H} are allowed`)}}',
        'if($.name==="mcp__engram__engram_store"&&typeof q==="object"&&q!==null){let t=q.entry_type,p=q.project_name,l=q.title,c=q.content;if((t==="decision"||t==="discovery"||t==="lesson"||t==="diagnostic")&&typeof p==="string"&&typeof l==="string"&&typeof c==="string")return{behavior:"allow",updatedInput:q};return {behavior:"deny",message:"Only structured Engram saves are allowed",decisionReason:{type:"other",reason:"Only structured Engram saves are allowed"}}}return $_7($,`only ${Iq}, ${i4}, ${e9}, read-only ${zq}, and ${MK}/${H_} within ${H} and mcp__engram__engram_store are allowed`)}}'
      )
      .replace(
        'All other tools \\u2014 MCP, Agent, write-capable ${zq}, etc \\u2014 will be denied.',
        'mcp__engram__engram_store is also allowed for structured decision/discovery/lesson/diagnostic memories from the recent messages. All other tools \\u2014 other MCP tools, Agent, write-capable ${zq}, etc \\u2014 will be denied.'
      )
      .replace(
        'if(!n4())return;if(A_())return;',
        'if(!O.toolUseContext.getAppState().mcp.clients.some(c=>c.name==="engram"&&c.type==="connected"))return;if(!n4())return;if(A_())return;'
      );

    expect(writeEngramMemoryBridge(alreadyPatched)).toBe(alreadyPatched);
  });

  it('patches 2.1.92 identifiers correctly', () => {
    const result = writeEngramMemoryBridge(mockAutoMemSnippet_2_1_92);

    expect(result).not.toBeNull();
    // Permission gate
    expect(result).toContain('$.name==="mcp__engram__engram_store"');
    expect(result).toContain('and mcp__engram__engram_store are allowed');
    // Prompt
    expect(result).toContain(
      'mcp__engram__engram_store is also allowed for structured decision/discovery/lesson/diagnostic memories from the recent messages.'
    );
    // Gate uses captured param name, not hardcoded O
    expect(result).toContain(
      'if(!O.toolUseContext.getAppState().mcp.clients.some(c=>c.name==="engram"&&c.type==="connected"))return;if(!e4())return;if(L_())return;'
    );
  });

  it('returns null when the auto-memory gate is absent', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = writeEngramMemoryBridge('function nope(){}');
    expect(result).toBeNull();
    vi.restoreAllMocks();
  });
});
