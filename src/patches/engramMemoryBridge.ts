// Please see the note about writing patches in ./index

import { showDiff } from './index';

export const writeEngramMemoryBridge = (oldFile: string): string | null => {
  const afterGateFile = oldFile; // just assigning for now

  // We are essentially checking if the minified code already has engram permission.
  const hasEngramPermission = afterGateFile.includes(
    'mcp__engram__engram_store'
  );

  const permissionPattern =
    /if\(\(\$\.name===[$\w]+\|\|\$\.name===[$\w]+\)&&\"file_path\"\s*in q\)\{let ([$\w]+)=q\.file_path;if\(typeof \1===\"string\"&&[$\w]+\(\1\)\)return\{behavior:\"allow\",updatedInput:q\}\}[^}]*return [$\w]+\(\$,`only \$\{[$\w]+\}, \$\{[$\w]+\\}, \$\{[$\w]+\}, read-only \$\{[$\w]+\}, and \$\{[$\w]+\}\/\$\{[$\w]+\} within \$\{H\} are allowed`\)\}\}/;

  const permissionMatch = afterGateFile.match(permissionPattern);

  if (
    !hasEngramPermission &&
    (!permissionMatch || permissionMatch.index === undefined)
  ) {
    console.error(
      'patch: engramMemoryBridge: failed to find auto-memory permission gate'
    );
    return null;
  }

  let afterPermissionFile = afterGateFile;

  if (!hasEngramPermission) {
    const permissionNeedle = permissionMatch![0];
    const permissionIndex = permissionMatch!.index!;

    // We will parse out the last bit of the needle so we can replace just the return.
    const lastReturnIndex = permissionNeedle.lastIndexOf('return');
    const firstPart = permissionNeedle.slice(0, lastReturnIndex);
    const lastPart = permissionNeedle.slice(lastReturnIndex);

    // E.g. "return $_7($,`only ${Iq} ... allowed`)}}"
    const modifiedLastPart =
      'if($.name==="mcp__engram__engram_store"&&typeof q==="object"&&q!==null){let t=q.entry_type,p=q.project_name,l=q.title,c=q.content;if((t==="decision"||t==="discovery"||t==="lesson"||t==="diagnostic")&&typeof p==="string"&&typeof l==="string"&&typeof c==="string")return{behavior:"allow",updatedInput:q};return {behavior:"deny",message:"Only structured Engram saves are allowed",decisionReason:{type:"other",reason:"Only structured Engram saves are allowed"}}}' +
      lastPart.replace(
        'are allowed`',
        'and mcp__engram__engram_store are allowed`'
      );

    const permissionReplacement = firstPart + modifiedLastPart;

    afterPermissionFile =
      afterGateFile.slice(0, permissionIndex) +
      permissionReplacement +
      afterGateFile.slice(permissionIndex + permissionNeedle.length);

    showDiff(
      afterGateFile,
      afterPermissionFile,
      permissionReplacement,
      permissionIndex,
      permissionIndex + permissionNeedle.length
    );
  }

  const promptPattern =
    /`Available tools: \$\{[$\w]+\}, \$\{[$\w]+\}, \$\{[$\w]+\}, read-only \$\{[$\w]+\} \(ls\/find\/cat\/stat\/wc\/head\/tail and similar\), and \$\{[$\w]+\}\/\$\{[$\w]+\\} for paths inside the memory directory only\. \$\{[$\w]+\} rm is not permitted\. All other tools \\u2014 MCP, Agent, write-capable \$\{[$\w]+\}, etc \\u2014 will be denied\.`/;
  const promptMatch = afterPermissionFile.match(promptPattern);
  const promptIndex = promptMatch ? promptMatch.index : -1;

  if (promptIndex === -1) {
    console.error(
      'patch: engramMemoryBridge: failed to find extract-memories prompt tools section'
    );
    return null;
  }

  let afterPromptFile = afterPermissionFile;
  const promptNeedle = promptMatch![0];
  if (!promptNeedle.includes('mcp__engram__engram_store')) {
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
    /async function z\(O,Y\)\{if\(O\.toolUseContext\.agentId\)return;if\(![$\w]+\("tengu_passport_quail",!1\)\)return;if\(!n4\(\)\)return;if\(A_\(\)\)return;/;
  const gateMatch = afterPromptFile.match(gatePattern);

  if (
    !afterPromptFile.includes('c.name==="engram"&&c.type==="connected"') &&
    (!gateMatch || gateMatch.index === undefined)
  ) {
    console.error(
      'patch: engramMemoryBridge: failed to find extract-memories execution gate'
    );
    return null;
  }

  let finalFile = afterPromptFile;
  if (!afterPromptFile.includes('c.name==="engram"&&c.type==="connected"')) {
    const gateNeedle = gateMatch![0];
    const gateIndex = gateMatch!.index!;
    const gateReplacement = gateNeedle.replace(
      'if(!n4())return;if(A_())return;',
      'let w=O.toolUseContext.getAppState().mcp.clients;if(!w.some((c:any)=>c.name==="engram"&&c.type==="connected"))return;if(!n4())return;if(A_())return;'
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
