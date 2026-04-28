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
    /(if\(\(([$\w]+)\.name===[$\w]+\|\|\2\.name===[$\w]+\)&&"file_path"\s*in ([$\w]+)\)\{(?:if\(\2\.name===[$\w]+&&[$\w]+\(\)\)return [$\w]+\(\2,`[^`]+`\);)?let [$\w]+=\3\.file_path;if\(typeof [$\w]+==="string"&&[$\w]+\([$\w]+\)\)return\{behavior:"allow",updatedInput:\3\}\})(return [$\w]+\(\2,`only \$\{[$\w]+\}, \$\{[$\w]+\}, \$\{[$\w]+\}, read-only \$\{[$\w]+\}, and \$\{[$\w]+\}\/\$\{[$\w]+\} within \$\{[$\w]+\} are allowed`\)\}\})/;
  const permissionMatch = oldFile.match(permissionPattern);
  const permissionPattern2 =
    /(if\(\(([$\w]+)\.name===[$\w]+\|\|\2\.name===[$\w]+\)&&"file_path"in q\)\{(?:if\(\2\.name===[$\w]+&&[$\w]+\(\)\)return [$\w]+\(\2,`[^`]+`\);)?let [$\w]+=q\.file_path;if\(typeof [$\w]+==="string"&&[$\w]+\([$\w]+\)\)return\{behavior:"allow",updatedInput:q\}\})(let [$\w]+=[$\w]+\(\)\?[$\w]+:[$\w]+;return [$\w]+\(\2,`only \$\{[$\w]+\}, \$\{[$\w]+\}, \$\{[$\w]+\}, read-only \$\{[$\w]+\}, and \$\{[$\w]+\}\/\$\{[$\w]+\} within \$\{[$\w]+\} are allowed`\)\}\})/;
  const permissionMatch2 = oldFile.match(permissionPattern2);

  if (
    !hasEngramPermission &&
    (!permissionMatch || permissionMatch.index === undefined) &&
    (!permissionMatch2 || permissionMatch2.index === undefined)
  ) {
    return oldFile;
  }

  let afterPermissionFile = oldFile;

  if (!hasEngramPermission) {
    const permissionGroups = (permissionMatch ??
      permissionMatch2) as RegExpMatchArray & {
      index: number;
    };
    const [permissionNeedle, allowWrites, toolVar, inputVar, denyTail] =
      permissionGroups;
    const permissionIndex = permissionGroups.index;
    const modifiedLastPart =
      `if(${toolVar}.name==="mcp__engram__engram_store"&&typeof ${inputVar}==="object"&&${inputVar}!==null){let t=${inputVar}.entry_type,p=${inputVar}.project_name,l=${inputVar}.title,c=${inputVar}.content;if((t==="decision"||t==="discovery"||t==="lesson"||t==="diagnostic")&&typeof p==="string"&&typeof l==="string"&&typeof c==="string")return{behavior:"allow",updatedInput:${inputVar}};return {behavior:"deny",message:"Only structured Engram saves are allowed",decisionReason:{type:"other",reason:"Only structured Engram saves are allowed"}}}` +
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
    /`Available tools: \$\{[$\w]+\}, \$\{[$\w]+\}, \$\{[$\w]+\}, read-only \$\{[$\w]+\} \([^)]+\),[^`]*?All other tools \\u2014 [^`]*?Agent, write-capable \$\{[$\w]+\}, etc \\u2014 will be denied\.`/;
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
    let promptReplacement = promptNeedle.replace(
      'All other tools \\u2014 MCP, Agent',
      'mcp__engram__engram_store is also allowed for structured decision/discovery/lesson/diagnostic memories from the recent messages. All other tools \\u2014 other MCP tools, Agent'
    );

    if (promptReplacement === promptNeedle) {
      promptReplacement = promptNeedle
        .replace(
          'rm is not permitted.',
          'rm is not permitted. mcp__engram__engram_store is also allowed for structured decision/discovery/lesson/diagnostic memories from the recent messages.'
        )
        .replace('MCP, Agent', 'other MCP tools, Agent');
    }

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
    /async function [$\w]+\(([$\w]+),[$\w]+\)\{if\(\1\.toolUseContext\.agentId\)return;if\(![$\w]+\("tengu_passport_quail",!1\)\)return;(?:if\(!\1\.toolUseContext\.getAppState\(\)\.mcp\.clients\.some\(c=>c\.name==="engram"&&c\.type==="connected"\)\)return;)?if\(!([$\w]+)\(\)\)return;if\(([$\w]+)\(\)\)return;/;
  const gateMatch = afterPromptFile.match(gatePattern);

  if (!hasEngramGate && (!gateMatch || gateMatch.index === undefined)) {
    console.error(
      'patch: engramMemoryBridge: failed to find extract-memories execution gate'
    );
    return null;
  }

  let finalFile = afterPromptFile;
  if (!hasEngramGate) {
    const gateNeedle = gateMatch![0];
    const gateIndex = gateMatch!.index!;
    const ctxParam = gateMatch![1];
    const autoMemFn = gateMatch![2];
    const isRemoteFn = gateMatch![3];
    const oldTail = `if(!${autoMemFn}())return;if(${isRemoteFn}())return;`;
    const gateReplacement = gateNeedle.replace(
      oldTail,
      `if(!${ctxParam}.toolUseContext.getAppState().mcp.clients.some(c=>c.name==="engram"&&c.type==="connected"))return;${oldTail}`
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
