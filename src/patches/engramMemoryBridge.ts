// Please see the note about writing patches in ./index

import { showDiff } from './index';

export const writeEngramMemoryBridge = (oldFile: string): string | null => {
  const permissionNeedle =
    'if(($.name===MK||$.name===H_)&&"file_path" in q){let K=q.file_path;if(typeof K==="string"&&Y8H(K))return{behavior:"allow",updatedInput:q}}return $_7($,`only ${Iq}, ${i4}, ${e9}, read-only ${zq}, and ${MK}/${H_} within ${H} are allowed`)}}';
  const permissionIndex = oldFile.indexOf(permissionNeedle);

  if (permissionIndex === -1) {
    console.error(
      'patch: engramMemoryBridge: failed to find auto-memory permission gate'
    );
    return null;
  }

  const permissionReplacement =
    'if(($.name===MK||$.name===H_)&&"file_path" in q){let K=q.file_path;if(typeof K==="string"&&Y8H(K))return{behavior:"allow",updatedInput:q}}if($.name==="mcp__engram__engram_store"&&typeof q==="object"&&q!==null){let __tweakccEntryType=q.entry_type,__tweakccProject=q.project_name,__tweakccTitle=q.title,__tweakccContent=q.content;if((__tweakccEntryType==="decision"||__tweakccEntryType==="discovery"||__tweakccEntryType==="lesson"||__tweakccEntryType==="diagnostic")&&typeof __tweakccProject==="string"&&typeof __tweakccTitle==="string"&&typeof __tweakccContent==="string")return{behavior:"allow",updatedInput:q};return $_7($,"Only structured Engram store calls for decision/discovery/lesson/diagnostic memories are permitted in this context")}return $_7($,`only ${Iq}, ${i4}, ${e9}, read-only ${zq}, and ${MK}/${H_} within ${H}, and mcp__engram__engram_store are allowed`)}}';

  const afterPermissionFile =
    oldFile.slice(0, permissionIndex) +
    permissionReplacement +
    oldFile.slice(permissionIndex + permissionNeedle.length);

  showDiff(
    oldFile,
    afterPermissionFile,
    permissionReplacement,
    permissionIndex,
    permissionIndex + permissionNeedle.length
  );

  const promptNeedle =
    '`Available tools: ${Iq}, ${i4}, ${e9}, read-only ${zq} (ls/find/cat/stat/wc/head/tail and similar), and ${MK}/${H_} for paths inside the memory directory only. ${zq} rm is not permitted. All other tools \\u2014 MCP, Agent, write-capable ${zq}, etc \\u2014 will be denied.`';
  const promptIndex = afterPermissionFile.indexOf(promptNeedle);

  if (promptIndex === -1) {
    console.error(
      'patch: engramMemoryBridge: failed to find extract-memories prompt tools section'
    );
    return null;
  }

  const promptReplacement =
    '`Available tools: ${Iq}, ${i4}, ${e9}, read-only ${zq} (ls/find/cat/stat/wc/head/tail and similar), and ${MK}/${H_} for paths inside the memory directory only. ${zq} rm is not permitted. The MCP tool mcp__engram__engram_store is also permitted for durable engineering memories. Use it only for high-signal decision/discovery/lesson/diagnostic entries grounded in the recent messages. All other tools \\u2014 other MCP tools, Agent, write-capable ${zq}, etc \\u2014 will be denied.`';

  const afterPromptFile =
    afterPermissionFile.slice(0, promptIndex) +
    promptReplacement +
    afterPermissionFile.slice(promptIndex + promptNeedle.length);

  showDiff(
    afterPermissionFile,
    afterPromptFile,
    promptReplacement,
    promptIndex,
    promptIndex + promptNeedle.length
  );

  return afterPromptFile;
};
