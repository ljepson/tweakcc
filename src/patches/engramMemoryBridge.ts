// Please see the note about writing patches in ./index

import { showDiff } from './index';

export const writeEngramMemoryBridge = (oldFile: string): string | null => {
  const hasEngramPermission = oldFile.includes('mcp__engram__engram_store');
  const hasEngramPrompt = oldFile.includes(
    'mcp__engram__engram_store is also allowed for structured decision/discovery/lesson/diagnostic memories from the recent messages.'
  );
  const hasEngramGate = oldFile.includes(
    'c.name==="engram"&&c.type==="connected"'
  );

  if (hasEngramPermission && hasEngramPrompt && hasEngramGate) {
    return oldFile;
  }

  const permissionPattern =
    /(if\(\(\$\.name===[$\w]+\|\|\$\.name===[$\w]+\)&&"file_path"\s*in q\)\{let [$\w]+=q\.file_path;if\(typeof [$\w]+==="string"&&[$\w]+\([$\w]+\)\)return\{behavior:"allow",updatedInput:q\}\})(return [$\w]+\(\$,`only \$\{[$\w]+\}, \$\{[$\w]+\}, \$\{[$\w]+\}, read-only \$\{[$\w]+\}, and \$\{[$\w]+\}\/\$\{[$\w]+\} within \$\{H\} are allowed`\)\}\})/;
  const permissionMatch = oldFile.match(permissionPattern);

  if (
    !hasEngramPermission &&
    (!permissionMatch || permissionMatch.index === undefined)
  ) {
    console.error(
      'patch: engramMemoryBridge: failed to find auto-memory permission gate'
    );
    return null;
  }

  let afterPermissionFile = oldFile;

  if (!hasEngramPermission) {
    const permissionGroups = permissionMatch as RegExpMatchArray & {
      index: number;
    };
    const [permissionNeedle, allowWrites, denyTail] = permissionGroups;
    const permissionIndex = permissionGroups.index;
    const modifiedLastPart =
      'if($.name==="mcp__engram__engram_store"&&typeof q==="object"&&q!==null){let t=q.entry_type,p=q.project_name,l=q.title,c=q.content;if((t==="decision"||t==="discovery"||t==="lesson"||t==="diagnostic")&&typeof p==="string"&&typeof l==="string"&&typeof c==="string")return{behavior:"allow",updatedInput:q};return {behavior:"deny",message:"Only structured Engram saves are allowed",decisionReason:{type:"other",reason:"Only structured Engram saves are allowed"}}}' +
      denyTail.replace(
        'are allowed`',
        'and mcp__engram__engram_store are allowed`'
      );

    const permissionReplacement = allowWrites + modifiedLastPart;

    afterPermissionFile =
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
  }

  const promptPattern =
    /`Available tools: \$\{[$\w]+\}, \$\{[$\w]+\}, \$\{[$\w]+\}, read-only \$\{[$\w]+\} \(ls\/find\/cat\/stat\/wc\/head\/tail and similar\), and \$\{[$\w]+\}\/\$\{[$\w]+\} for paths inside the memory directory only\. \$\{[$\w]+\} rm is not permitted\.[^`]*?All other tools \\u2014 [^`]*?Agent, write-capable \$\{[$\w]+\}, etc \\u2014 will be denied\.`/;
  const promptMatch = afterPermissionFile.match(promptPattern);
  const promptIndex = promptMatch ? promptMatch.index : -1;

  if (!hasEngramPrompt && promptIndex === -1) {
    console.error(
      'patch: engramMemoryBridge: failed to find extract-memories prompt tools section'
    );
    return null;
  }

  let afterPromptFile = afterPermissionFile;
  const promptNeedle = promptMatch?.[0];
  if (!hasEngramPrompt && promptNeedle) {
    const promptReplacement = promptNeedle
      .replace(
        'rm is not permitted.',
        'rm is not permitted. mcp__engram__engram_store is also allowed for structured decision/discovery/lesson/diagnostic memories from the recent messages.'
      )
      .replace('MCP, Agent', 'other MCP tools, Agent');

    afterPromptFile =
      afterPermissionFile.slice(0, promptIndex!) +
      promptReplacement +
      afterPermissionFile.slice(promptIndex! + promptNeedle.length);

    showDiff(
      afterPermissionFile,
      afterPromptFile,
      promptReplacement,
      promptIndex!,
      promptIndex! + promptNeedle.length
    );
  }

  const gatePattern =
    /async function z\(O,Y\)\{if\(O\.toolUseContext\.agentId\)return;if\(![$\w]+\("tengu_passport_quail",!1\)\)return;(?:let [$\w]+=O\.toolUseContext\.getAppState\(\)\.mcp\.clients;if\(![$\w]+\.some\(c=>c\.name==="engram"&&c\.type==="connected"\)\)return;)?if\(!n4\(\)\)return;if\(A_\(\)\)return;/;
  const gateMatch = afterPromptFile.match(gatePattern);

  if (
    !hasEngramGate &&
    (!gateMatch || gateMatch.index === undefined)
  ) {
    console.error(
      'patch: engramMemoryBridge: failed to find extract-memories execution gate'
    );
    return null;
  }

  let finalFile = afterPromptFile;
  if (!hasEngramGate) {
    const gateNeedle = gateMatch![0];
    const gateIndex = gateMatch!.index!;
    const gateReplacement = gateNeedle.replace(
      'if(!n4())return;if(A_())return;',
      'let w=O.toolUseContext.getAppState().mcp.clients;if(!w.some(c=>c.name==="engram"&&c.type==="connected"))return;if(!n4())return;if(A_())return;'
    );
    finalFile =
      afterPromptFile.slice(0, gateIndex) +
      gateReplacement +
      afterPromptFile.slice(gateIndex + gateNeedle.length);

    showDiff(
      afterPromptFile,
      finalFile,
      gateReplacement,
      gateIndex,
      gateIndex + gateNeedle.length
    );
  }

  return finalFile;
};
