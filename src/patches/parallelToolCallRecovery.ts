import { showDiff } from './index';

const IS_ENABLED =
  'globalThis.__tweakccConfig?.settings?.misc?.enableParallelToolCallRecovery';
const NATIVE_RECOVERY_MARKER = 'tengu_chain_parallel_tr_recovered';
const PATCH_MARKER = '__tweakccRecoverParallelToolCalls';
const HELPER_DECLARATION = `function ${PATCH_MARKER}`;
const BUN_CJS_MARKER =
  '(function(exports, require, module, __filename, __dirname) {';

const RECOVERY_HELPER = `function __tweakccRecoverParallelToolCalls(msgsByUuid,chain,chainUuids){let assistants=chain.filter(m=>m.type==="assistant");if(assistants.length===0)return chain;let firstByMessageId=new Map;for(let m of assistants)if(m.message?.id&&!firstByMessageId.has(m.message.id))firstByMessageId.set(m.message.id,m);let assistantsByMessageId=new Map,usersByParentUuid=new Map;for(let m of msgsByUuid.values())if(m.type==="assistant"&&m.message?.id){let group=assistantsByMessageId.get(m.message.id);if(group)group.push(m);else assistantsByMessageId.set(m.message.id,[m])}else if(m.type==="user"&&m.parentUuid&&Array.isArray(m.message?.content)&&m.message.content.some(block=>block.type==="tool_result")){let group=usersByParentUuid.get(m.parentUuid);if(group)group.push(m);else usersByParentUuid.set(m.parentUuid,[m])}let seenMessageIds=new Set,inserts=new Map;for(let assistant of assistants){let messageId=assistant.message?.id;if(!messageId||seenMessageIds.has(messageId))continue;seenMessageIds.add(messageId);let extraAssistants=(assistantsByMessageId.get(messageId)??[assistant]).filter(m=>!chainUuids.has(m.uuid)),extraUsers=[];for(let sibling of assistantsByMessageId.get(messageId)??[assistant]){let users=usersByParentUuid.get(sibling.uuid);if(!users)continue;for(let user of users)if(!chainUuids.has(user.uuid))extraUsers.push(user)}if(extraAssistants.length===0&&extraUsers.length===0)continue;extraAssistants.sort((a,b)=>a.timestamp.localeCompare(b.timestamp)),extraUsers.sort((a,b)=>a.timestamp.localeCompare(b.timestamp));let anchor=firstByMessageId.get(messageId)??assistant,recovered=[...extraAssistants,...extraUsers];for(let m of recovered)chainUuids.add(m.uuid);inserts.set(anchor.uuid,recovered)}if(inserts.size===0)return chain;let out=[];for(let m of chain){out.push(m);let recovered=inserts.get(m.uuid);if(recovered)out.push(...recovered)}return out}`;

export const writeParallelToolCallRecovery = (
  oldFile: string
): string | null => {
  if (
    oldFile.includes(PATCH_MARKER) ||
    oldFile.includes(NATIVE_RECOVERY_MARKER)
  ) {
    return oldFile;
  }

  const legacyChainPattern =
    /function ([$\w]+)\(([$\w]+),([$\w]+)\)\{let ([$\w]+)=\[\],([$\w]+)=new Set,([$\w]+)=\3;while\(\6\)\{if\(\5\.has\(\6\.uuid\)\)\{[\s\S]*?break\}[\s\S]*?\5\.add\(\6\.uuid\),\4\.push\(\6\);let ([$\w]+)=\6\.parentUuid;if\(!\7\)break;let ([$\w]+)=\2\.get\(\7\);(?:if\(!\8\)\{[\s\S]*?\})?\6=\8\}return \4\.reverse\(\)\}/;

  const legacyChainMatch = oldFile.match(legacyChainPattern);
  if (!legacyChainMatch) {
    return null;
  }

  const messagesByUuidVar = legacyChainMatch[2];
  const chainVar = legacyChainMatch[4];
  const chainUuidsVar = legacyChainMatch[5];

  const patchedChainFn = legacyChainMatch[0].replace(
    `return ${chainVar}.reverse()`,
    `return ${chainVar}.reverse(),${IS_ENABLED}?${PATCH_MARKER}(${messagesByUuidVar},${chainVar},${chainUuidsVar}):${chainVar}`
  );

  let newFile = oldFile.replace(legacyChainPattern, patchedChainFn);

  if (newFile === oldFile) {
    return null;
  }

  if (!newFile.includes(HELPER_DECLARATION)) {
    const markerIndex = newFile.indexOf(BUN_CJS_MARKER);
    if (markerIndex !== -1) {
      const insertPoint = markerIndex + BUN_CJS_MARKER.length;
      newFile =
        newFile.slice(0, insertPoint) +
        '\n' +
        RECOVERY_HELPER +
        newFile.slice(insertPoint);
    } else {
      newFile = `${RECOVERY_HELPER}\n${newFile}`;
    }
  }

  showDiff(oldFile, newFile, 'Parallel Tool Call Recovery Patch', 0, 100);
  return newFile;
};
