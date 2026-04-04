// Context Collapse Patch - Archive-based context management
//
// This patch hooks into Claude Code's native compaction/retry/session-restore codepaths
// to provide context collapse functionality without global class injection.
//
// Native anchors used:
// - DU9 query state machine (query_microcompact_end -> query_autocompact_start)
// - Persisted app state fields: contextCollapseCommits, contextCollapseSnapshot
// - Built-in compact_boundary message parsing with compactMetadata.preservedSegment
//
// The patch:
// 1. Extends DU9's local retry state with collapse commits/snapshot
// 2. Hooks DU9 query path to project archived spans as compact_boundary summaries
// 3. Hooks 413 retry path to drain staged spans when context overflows
// 4. Disables native autoCompact when context collapse is enabled
// 5. Defaults persisted collapse state on real resume/transcript object returns
//
// Supported versions: 2.1.89+

import { showDiff } from './index';

// Check if context collapse is enabled via config
const IS_ENABLED_CHECK = `globalThis.__tweakccConfig?.settings?.misc?.enableContextCollapse`;

// Helper function to project messages with compact_boundary summaries
// Uses generic parameter names (msgs, commits, staged, ratio) — not bound to any minified name
const PROJECT_VIEW_HELPER = `
function __tweakccProjectCollapseView(msgs,commits,staged,ratio){
  if(!commits?.length&&!staged?.length)return msgs;
  let res=[...msgs];
  for(let c of(commits||[])){
    let startIdx=res.findIndex(m=>m.uuid===c.firstArchivedUuid);
    let endIdx=res.findIndex(m=>m.uuid===c.lastArchivedUuid);
    if(startIdx!==-1&&endIdx!==-1&&endIdx>=startIdx){
      res.splice(startIdx,endIdx-startIdx+1,{
        type:"system",subtype:"compact_boundary",
        content:c.summaryContent||"[Archived context]",
        level:"info",uuid:c.summaryUuid,
        timestamp:new Date().toISOString(),
        compactMetadata:{messagesSummarized:endIdx-startIdx+1,preservedSegment:c.preservedSegment}
      });
    }
  }
  if(ratio>0.93)for(let s of(staged||[])){
    let startIdx=res.findIndex(m=>m.uuid===s.startUuid);
    let endIdx=res.findIndex(m=>m.uuid===s.endUuid);
    if(startIdx!==-1&&endIdx!==-1&&endIdx>=startIdx){
      res.splice(startIdx,endIdx-startIdx+1,{
        type:"system",subtype:"compact_boundary",
        content:"[Staged for archive] "+(s.summary||"Collapsed messages"),
        level:"info",uuid:"staged-"+Math.random().toString(36).slice(2),
        timestamp:new Date().toISOString(),
        compactMetadata:{messagesSummarized:endIdx-startIdx+1,isStaged:true,preservedSegment:s.preservedSegment}
      });
    }
  }
  return res;
}
`;

// Helper to apply collapses and stage new spans
// Uses generic parameter names — not bound to any minified name
const APPLY_COLLAPSES_HELPER = `
async function __tweakccApplyCollapses(msgs,ctx,commits,staged,enabled,nativeExceeds,nativeBlocking){
  if(!enabled)return{messages:msgs,commits,staged,ratio:0};
  let testLimit=+process.env.TWEAKCC_CONTEXT_COLLAPSE_TEST_LIMIT;
  let limit=Number.isFinite(testLimit)&&testLimit>0?testLimit:+ctx?.getAppState?.()?.contextLimit;
  if(!(Number.isFinite(limit)&&limit>0))limit=+process.env.CLAUDE_CODE_CONTEXT_LIMIT||200000;
  let ratio=nativeBlocking?0.96:nativeExceeds?0.93:JSON.stringify(msgs).length/4/limit;
  if(ratio<=0.90)return{messages:__tweakccProjectCollapseView(msgs,commits,staged,ratio),commits,staged,ratio};
  if(ratio>0.95&&staged?.length){
    let span=staged.shift();
    commits.push({
      type:"context-collapse-commit",sessionId:"default",collapseId:Date.now().toString(),
      summaryUuid:Math.random().toString(36).slice(2),
      summaryContent:span.summary||"Archived context segment",
      firstArchivedUuid:span.startUuid,lastArchivedUuid:span.endUuid,
      preservedSegment:span.preservedSegment
    });
  }else{
    let firstUser=-1,pairCount=0,lastAssistant=-1;
    for(let i=0;i<msgs.length;i++){
      let m=msgs[i];
      if(firstUser===-1&&m.type==="user"&&!m.isMeta)firstUser=i;
      if(firstUser!==-1&&m.type==="assistant"){
        lastAssistant=i;
        pairCount++;
        if(pairCount>=5)break;
      }
    }
    if(firstUser!==-1&&lastAssistant!==-1&&lastAssistant>firstUser){
      let startUuid=msgs[firstUser].uuid;
      if(!staged.some(s=>s.startUuid===startUuid)){
        staged.push({
          startUuid,endUuid:msgs[lastAssistant].uuid,
          summary:"Collapsed older messages to preserve context.",
          preservedSegment:{start:msgs[firstUser].timestamp,end:msgs[lastAssistant].timestamp},
          risk:0.1,stagedAt:Date.now()
        });
      }
    }
  }
  return{messages:__tweakccProjectCollapseView(msgs,commits,staged,ratio),commits,staged,ratio};
}
`;

// Helper to drain staged span on overflow
// Uses generic parameter names — not bound to any minified name
const DRAIN_OVERFLOW_HELPER = `
function __tweakccDrainOverflow(msgs,commits,staged){
  if(!staged?.length)return{messages:msgs,committed:0,staged};
  let span=staged.shift();
  commits.push({
    type:"context-collapse-commit",sessionId:"default",collapseId:Date.now().toString(),
    summaryUuid:Math.random().toString(36).slice(2),
    summaryContent:span.summary||"Archived context segment",
    firstArchivedUuid:span.startUuid,lastArchivedUuid:span.endUuid,
    preservedSegment:span.preservedSegment
  });
  return{messages:__tweakccProjectCollapseView(msgs,commits,staged,1),committed:1,staged};
}
`;

export const writeContextCollapse = (oldFile: string): string | null => {
  // Idempotency check — uses structural markers, not variable names
  if (
    oldFile.includes('__tweakccProjectCollapseView') &&
    oldFile.includes(
      '.toolUseContext.getAppState?.().contextCollapseCommits??[]'
    )
  ) {
    return oldFile;
  }

  // Inject helper functions after the Bun CJS wrapper
  const helpers =
    PROJECT_VIEW_HELPER + APPLY_COLLAPSES_HELPER + DRAIN_OVERFLOW_HELPER;
  const BUN_CJS_MARKER =
    '(function(exports, require, module, __filename, __dirname) {';
  const markerIdx = oldFile.indexOf(BUN_CJS_MARKER);
  let newFile: string;
  if (markerIdx !== -1) {
    const insertPoint = markerIdx + BUN_CJS_MARKER.length;
    newFile =
      oldFile.slice(0, insertPoint) +
      '\n' +
      helpers +
      oldFile.slice(insertPoint);
  } else {
    newFile = helpers + '\n' + oldFile;
  }

  // =========================================================================
  // Patch 1: Extend DU9 local retry state with context collapse fields
  // =========================================================================
  // Captures: $1=stateVar (M), $2=paramVar (H)
  const du9StateInitPattern =
    /let ([$\w]+)=\{messages:([$\w]+)\.messages,toolUseContext:\2\.toolUseContext,maxOutputTokensOverride:\2\.maxOutputTokensOverride,autoCompactTracking:void 0,stopHookActive:void 0,maxOutputTokensRecoveryCount:0,hasAttemptedReactiveCompact:!1,turnCount:1,pendingToolUseSummary:void 0,transition:void 0\};/;
  const du9StateInitMatch = newFile.match(du9StateInitPattern);

  if (!du9StateInitMatch) {
    console.error('patch: contextCollapse: failed to find DU9 state init');
    return null;
  }

  const stateVar = du9StateInitMatch[1]; // M
  const paramVar = du9StateInitMatch[2]; // H

  const du9StateInitReplacement = `let ${stateVar}={messages:${paramVar}.messages,toolUseContext:${paramVar}.toolUseContext,maxOutputTokensOverride:${paramVar}.maxOutputTokensOverride,autoCompactTracking:void 0,stopHookActive:void 0,maxOutputTokensRecoveryCount:0,hasAttemptedReactiveCompact:!1,turnCount:1,pendingToolUseSummary:void 0,transition:void 0,contextCollapseCommits:${paramVar}.toolUseContext.getAppState?.().contextCollapseCommits??[],contextCollapseSnapshot:${paramVar}.toolUseContext.getAppState?.().contextCollapseSnapshot??{staged:[]}};`;
  newFile = newFile.replace(du9StateInitPattern, du9StateInitReplacement);

  // Captures: $1=toolUseCtx (v), $2=stateVar (M), $3=msgs (k), $4=autoCompactTracking (V),
  //           $5=maxOutRecovery (E), $6=hasAttemptedReactive (I), $7=maxOutOverride (h),
  //           $8=pendingToolUse (x), $9=stopHook (b), $10=turnCount (B), $11=nextVar (p)
  const du9StateReadPattern =
    /let\{toolUseContext:([$\w]+)\}=([$\w]+),\{messages:([$\w]+),autoCompactTracking:([$\w]+),maxOutputTokensRecoveryCount:([$\w]+),hasAttemptedReactiveCompact:([$\w]+),maxOutputTokensOverride:([$\w]+),pendingToolUseSummary:([$\w]+),stopHookActive:([$\w]+),turnCount:([$\w]+)\}=\2,([$\w]+)=/;
  const du9StateReadMatch = newFile.match(du9StateReadPattern);

  if (!du9StateReadMatch) {
    console.error(
      'patch: contextCollapse: failed to find DU9 state destructure'
    );
    return null;
  }

  const toolUseCtx = du9StateReadMatch[1]; // v
  // du9StateReadMatch[2] is stateVar again (M) — verified by backreference
  const msgsVar = du9StateReadMatch[3]; // k
  const autoCompactTrackingVar = du9StateReadMatch[4]; // V
  const maxOutRecoveryVar = du9StateReadMatch[5]; // E
  const hasAttemptedReactiveVar = du9StateReadMatch[6]; // I
  const maxOutOverrideVar = du9StateReadMatch[7]; // h
  const pendingToolUseVar = du9StateReadMatch[8]; // x
  const stopHookVar = du9StateReadMatch[9]; // b
  const turnCountVar = du9StateReadMatch[10]; // B
  const nextVar = du9StateReadMatch[11]; // p

  const du9StateReadReplacement = `let{toolUseContext:${toolUseCtx}}=${stateVar},{messages:${msgsVar},autoCompactTracking:${autoCompactTrackingVar},maxOutputTokensRecoveryCount:${maxOutRecoveryVar},hasAttemptedReactiveCompact:${hasAttemptedReactiveVar},maxOutputTokensOverride:${maxOutOverrideVar},pendingToolUseSummary:${pendingToolUseVar},stopHookActive:${stopHookVar},turnCount:${turnCountVar},contextCollapseCommits:__ccCommits,contextCollapseSnapshot:__ccSnapshot}=${stateVar},${nextVar}=`;
  newFile = newFile.replace(du9StateReadPattern, du9StateReadReplacement);

  // =========================================================================
  // Patch 2: Hook DU9 query state machine to apply collapses
  // =========================================================================
  // Captures: $1=traceFn (p4/Q4), $2=between content, $3=traceFn again
  const du9Pattern =
    /([$\w]+)\("query_microcompact_end"\);(.*?)([$\w]+)\("query_autocompact_start"\);/;
  const du9Match = newFile.match(du9Pattern);

  if (!du9Match || du9Match.index === undefined) {
    console.error('patch: contextCollapse: failed to find DU9 injection site');
    return null;
  }

  const traceFn = du9Match[1];

  // Discover the messages variable used in the DU9 function body and the native
  // token-counting infrastructure by finding the blocking-limit check pattern:
  //   checkLimitsFn(tokenCountFn(messagesVar)-offsetVar,toolUseCtx.options.mainLoopModel,...)
  // This pattern appears in the same function, after the autocompact call.
  const blockingCheckPattern = new RegExp(
    `([$\\w]+)\\(([$\\w]+)\\(([$\\w]+)\\)-([$\\w]+),${toolUseCtx.replace(/\$/g, '\\$')}\\.options\\.mainLoopModel,${toolUseCtx.replace(/\$/g, '\\$')}\\.getAppState\\(\\)\\.autoCompactWindow\\)`
  );
  const blockingCheckMatch = newFile.match(blockingCheckPattern);

  if (!blockingCheckMatch) {
    console.error(
      'patch: contextCollapse: failed to find blocking limit check pattern'
    );
    return null;
  }

  const checkLimitsFn = blockingCheckMatch[1]; // owH/BMH
  const tokenCountFn = blockingCheckMatch[2]; // yW/_D
  const forkMsgsVar = blockingCheckMatch[3]; // F/d — the messages copy used at query time
  const offsetVar = blockingCheckMatch[4]; // qH/o

  const du9Replacement = `${traceFn}("query_microcompact_end");
if(${IS_ENABLED_CHECK}){
  let __ccLimits=${checkLimitsFn}(${tokenCountFn}(${forkMsgsVar})-${offsetVar},${toolUseCtx}.options.mainLoopModel,${toolUseCtx}.getAppState().autoCompactWindow);
  let __ccRes=await __tweakccApplyCollapses(${forkMsgsVar},${toolUseCtx},__ccCommits,__ccSnapshot?.staged||[],!0,__ccLimits?.isAboveAutoCompactThreshold,__ccLimits?.isAtBlockingLimit);
  ${forkMsgsVar}=__ccRes.messages;
  __ccCommits=__ccRes.commits;
  __ccSnapshot={staged:__ccRes.staged};
  ${stateVar}={...${stateVar},messages:${forkMsgsVar},contextCollapseCommits:__ccCommits,contextCollapseSnapshot:__ccSnapshot};
  ${toolUseCtx}?.setAppState?.(s=>({...s,contextCollapseCommits:__ccCommits,contextCollapseSnapshot:__ccSnapshot}));
}
${du9Match[2]}${traceFn}("query_autocompact_start");`;

  newFile = newFile.replace(du9Match[0], du9Replacement);

  // =========================================================================
  // Patch 3: Hook 413 retry path to drain staged spans on overflow
  // =========================================================================
  const retryPattern =
    /if\(\([$\w]+\|\|[$\w]+\)&&[$\w]+\)\{.*?transition:\{reason:"reactive_compact_retry"\}\};continue\}/;
  const retryMatch = newFile.match(retryPattern);

  if (retryMatch && retryMatch.index !== undefined) {
    // Extract the condition variables from the match
    const conditionVars = retryMatch[0].match(
      /if\(\(([$\w]+)\|\|([$\w]+)\)&&([$\w]+)\)/
    );
    if (conditionVars) {
      const [, condA, condB] = conditionVars;
      const drainLogic = `if((${condA}||${condB})&&${IS_ENABLED_CHECK}){
  let __ccDrained=__tweakccDrainOverflow(${forkMsgsVar},__ccCommits,__ccSnapshot?.staged||[]);
  if(__ccDrained.committed>0){
    ${forkMsgsVar}=__ccDrained.messages;
    __ccSnapshot={staged:__ccDrained.staged};
    ${toolUseCtx}?.setAppState?.(s=>({...s,contextCollapseCommits:__ccCommits,contextCollapseSnapshot:__ccSnapshot}));
    ${stateVar}={messages:${forkMsgsVar},toolUseContext:${toolUseCtx},autoCompactTracking:void 0,maxOutputTokensRecoveryCount:${maxOutRecoveryVar},hasAttemptedReactiveCompact:${hasAttemptedReactiveVar},maxOutputTokensOverride:void 0,pendingToolUseSummary:void 0,stopHookActive:void 0,turnCount:${turnCountVar},contextCollapseCommits:__ccCommits,contextCollapseSnapshot:__ccSnapshot,transition:{reason:"collapse_drain_retry"}};
    continue;
  }
}`;
      newFile = newFile.replace(retryMatch[0], drainLogic + retryMatch[0]);
    }
  }

  // =========================================================================
  // Patch 4: Disable native autoCompact when context collapse is enabled
  // =========================================================================
  // Pattern: async function v_7(...){
  const autoCompactPattern = /async function ([$\w]+)\([A-Za-z0-9_$,]*\)\{/g;
  const autoCompactMatches = Array.from(newFile.matchAll(autoCompactPattern));

  // Find the autoCompact function by looking for characteristic patterns nearby
  for (const match of autoCompactMatches) {
    const fnStart = match.index! + match[0].length;
    const fnPreview = newFile.slice(fnStart, fnStart + 500);

    // AutoCompact function contains compaction patterns
    if (
      fnPreview.includes('compactionResult') ||
      fnPreview.includes('consecutiveFailures')
    ) {
      const guardInjection = `if(${IS_ENABLED_CHECK})return{compactionResult:void 0,consecutiveFailures:0,consecutiveRapidRefills:0,rapidRefillBreakerTripped:!1};`;
      newFile =
        newFile.slice(0, fnStart) + guardInjection + newFile.slice(fnStart);
      break;
    }
  }

  // =========================================================================
  // Patch 5: Default collapse state on actual resume/transcript object returns
  // =========================================================================
  // Each pattern uses capture groups for variable names, then reconstructs
  // the replacement using the captured values.

  // Pattern 1: Simple optional-chain access (q?.contextCollapseCommits)
  // Captures: $1=objectVar (q)
  const restore1Pattern =
    /contextCollapseCommits:([$\w]+)\?\.contextCollapseCommits,contextCollapseSnapshot:\1\?\.contextCollapseSnapshot,/g;
  newFile = newFile.replace(
    restore1Pattern,
    (_, objVar) =>
      `contextCollapseCommits:${objVar}?.contextCollapseCommits??[],contextCollapseSnapshot:${objVar}?.contextCollapseSnapshot??{staged:[]},`
  );

  // Pattern 2: filter with sessionId equality (w.filter((k)=>k.sessionId===v),...M?.sessionId===v)
  // Captures: $1=arrayVar (w), $2=iterVar (k), $3=sessionVar (v), $4=snapshotVar (M)
  const restore2Pattern =
    /contextCollapseCommits:([$\w]+)\.filter\(\(([$\w]+)\)=>\2\.sessionId===([$\w]+)\),contextCollapseSnapshot:([$\w]+)\?\.sessionId===\3\?\4:void 0,/g;
  newFile = newFile.replace(
    restore2Pattern,
    (_, arrVar, iterVar, sessVar, snapVar) =>
      `contextCollapseCommits:${arrVar}.filter((${iterVar})=>${iterVar}.sessionId===${sessVar}),contextCollapseSnapshot:${snapVar}?.sessionId===${sessVar}?${snapVar}:{staged:[]},`
  );

  // Pattern 3: conditional filter with ternary (V?L.filter((E)=>E.sessionId===V):void 0,...V&&Z?.sessionId===V?Z:void 0)
  // Captures: $1=condVar (V), $2=arrayVar (L), $3=iterVar (E), $4=snapshotVar (Z)
  const restore3Pattern =
    /contextCollapseCommits:([$\w]+)\?([$\w]+)\.filter\(\(([$\w]+)\)=>\3\.sessionId===\1\):void 0,contextCollapseSnapshot:\1&&([$\w]+)\?\.sessionId===\1\?\4:void 0/g;
  newFile = newFile.replace(
    restore3Pattern,
    (_, condVar, arrVar, iterVar, snapVar) =>
      `contextCollapseCommits:${condVar}?${arrVar}.filter((${iterVar})=>${iterVar}.sessionId===${condVar}):[],contextCollapseSnapshot:${condVar}&&${snapVar}?.sessionId===${condVar}?${snapVar}:{staged:[]}`
  );

  // Pattern 4: filter without trailing comma (w.filter((Z)=>Z.sessionId===H),...M?.sessionId===H?M:void 0)
  // Captures: $1=arrayVar (w), $2=iterVar (Z), $3=sessionVar (H), $4=snapshotVar (M)
  const restore4Pattern =
    /contextCollapseCommits:([$\w]+)\.filter\(\(([$\w]+)\)=>\2\.sessionId===([$\w]+)\),contextCollapseSnapshot:([$\w]+)\?\.sessionId===\3\?\4:void 0(?!,)/g;
  newFile = newFile.replace(
    restore4Pattern,
    (_, arrVar, iterVar, sessVar, snapVar) =>
      `contextCollapseCommits:${arrVar}.filter((${iterVar})=>${iterVar}.sessionId===${sessVar}),contextCollapseSnapshot:${snapVar}?.sessionId===${sessVar}?${snapVar}:{staged:[]}`
  );

  showDiff(oldFile, newFile, 'Context Collapse Patch', 0, 100);
  return newFile;
};
