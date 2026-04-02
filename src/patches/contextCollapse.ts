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
// Supported versions: 2.1.89 (brittle native patterns)

import { showDiff } from './index';

// Check if context collapse is enabled via config
const IS_ENABLED_CHECK = `globalThis.__tweakccConfig?.settings?.misc?.enableContextCollapse`;

// Helper function to project messages with compact_boundary summaries
const PROJECT_VIEW_HELPER = `
function __tweakccProjectCollapseView(F,commits,staged,ratio){
  if(!commits?.length&&!staged?.length)return F;
  let res=[...F];
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
const APPLY_COLLAPSES_HELPER = `
async function __tweakccApplyCollapses(F,v,commits,staged,enabled,nativeExceeds,nativeBlocking){
  if(!enabled)return{messages:F,commits,staged,ratio:0};
  let testLimit=+process.env.TWEAKCC_CONTEXT_COLLAPSE_TEST_LIMIT;
  let limit=Number.isFinite(testLimit)&&testLimit>0?testLimit:+v?.getAppState?.()?.contextLimit;
  if(!(Number.isFinite(limit)&&limit>0))limit=+process.env.CLAUDE_CODE_CONTEXT_LIMIT||200000;
  let ratio=nativeBlocking?0.96:nativeExceeds?0.93:JSON.stringify(F).length/4/limit;
  if(ratio<=0.90)return{messages:__tweakccProjectCollapseView(F,commits,staged,ratio),commits,staged,ratio};
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
    for(let i=0;i<F.length;i++){
      let m=F[i];
      if(firstUser===-1&&m.type==="user"&&!m.isMeta)firstUser=i;
      if(firstUser!==-1&&m.type==="assistant"){
        lastAssistant=i;
        pairCount++;
        if(pairCount>=5)break;
      }
    }
    if(firstUser!==-1&&lastAssistant!==-1&&lastAssistant>firstUser){
      let startUuid=F[firstUser].uuid;
      if(!staged.some(s=>s.startUuid===startUuid)){
        staged.push({
          startUuid,endUuid:F[lastAssistant].uuid,
          summary:"Collapsed older messages to preserve context.",
          preservedSegment:{start:F[firstUser].timestamp,end:F[lastAssistant].timestamp},
          risk:0.1,stagedAt:Date.now()
        });
      }
    }
  }
  return{messages:__tweakccProjectCollapseView(F,commits,staged,ratio),commits,staged,ratio};
}
`;

// Helper to drain staged span on overflow
const DRAIN_OVERFLOW_HELPER = `
function __tweakccDrainOverflow(F,commits,staged){
  if(!staged?.length)return{messages:F,committed:0,staged};
  let span=staged.shift();
  commits.push({
    type:"context-collapse-commit",sessionId:"default",collapseId:Date.now().toString(),
    summaryUuid:Math.random().toString(36).slice(2),
    summaryContent:span.summary||"Archived context segment",
    firstArchivedUuid:span.startUuid,lastArchivedUuid:span.endUuid,
    preservedSegment:span.preservedSegment
  });
  return{messages:__tweakccProjectCollapseView(F,commits,staged,1),committed:1,staged};
}
`;

export const writeContextCollapse = (oldFile: string): string | null => {
  // Idempotency check
  if (
    oldFile.includes('__tweakccProjectCollapseView') &&
    oldFile.includes(
      'contextCollapseCommits:H.toolUseContext.getAppState?.().contextCollapseCommits??[]'
    )
  ) {
    return oldFile;
  }

  // Inject helper functions at the start of the bundle
  let newFile =
    PROJECT_VIEW_HELPER +
    APPLY_COLLAPSES_HELPER +
    DRAIN_OVERFLOW_HELPER +
    oldFile;

  // =========================================================================
  // Patch 1: Extend DU9 local retry state with context collapse fields
  // =========================================================================
  const du9StateInitPattern =
    /let M=\{messages:H\.messages,toolUseContext:H\.toolUseContext,maxOutputTokensOverride:H\.maxOutputTokensOverride,autoCompactTracking:void 0,stopHookActive:void 0,maxOutputTokensRecoveryCount:0,hasAttemptedReactiveCompact:!1,turnCount:1,pendingToolUseSummary:void 0,transition:void 0\};/;
  const du9StateInitMatch = newFile.match(du9StateInitPattern);

  if (!du9StateInitMatch) {
    console.error('patch: contextCollapse: failed to find DU9 state init');
    return null;
  }

  const du9StateInitReplacement =
    'let M={messages:H.messages,toolUseContext:H.toolUseContext,maxOutputTokensOverride:H.maxOutputTokensOverride,autoCompactTracking:void 0,stopHookActive:void 0,maxOutputTokensRecoveryCount:0,hasAttemptedReactiveCompact:!1,turnCount:1,pendingToolUseSummary:void 0,transition:void 0,contextCollapseCommits:H.toolUseContext.getAppState?.().contextCollapseCommits??[],contextCollapseSnapshot:H.toolUseContext.getAppState?.().contextCollapseSnapshot??{staged:[]}};';
  newFile = newFile.replace(du9StateInitPattern, du9StateInitReplacement);

  const du9StateReadPattern =
    /let\{toolUseContext:v\}=M,\{messages:k,autoCompactTracking:V,maxOutputTokensRecoveryCount:E,hasAttemptedReactiveCompact:I,maxOutputTokensOverride:h,pendingToolUseSummary:x,stopHookActive:b,turnCount:B\}=M,p=/;
  const du9StateReadMatch = newFile.match(du9StateReadPattern);

  if (!du9StateReadMatch) {
    console.error(
      'patch: contextCollapse: failed to find DU9 state destructure'
    );
    return null;
  }

  const du9StateReadReplacement =
    'let{toolUseContext:v}=M,{messages:k,autoCompactTracking:V,maxOutputTokensRecoveryCount:E,hasAttemptedReactiveCompact:I,maxOutputTokensOverride:h,pendingToolUseSummary:x,stopHookActive:b,turnCount:B,contextCollapseCommits:CC,contextCollapseSnapshot:CS}=M,p=';
  newFile = newFile.replace(du9StateReadPattern, du9StateReadReplacement);

  // =========================================================================
  // Patch 2: Hook DU9 query state machine to apply collapses
  // =========================================================================
  const du9Pattern =
    /p4\("query_microcompact_end"\);(.*?)p4\("query_autocompact_start"\);/;
  const du9Match = newFile.match(du9Pattern);

  if (!du9Match || du9Match.index === undefined) {
    console.error('patch: contextCollapse: failed to find DU9 injection site');
    return null;
  }

  const du9Replacement = `p4("query_microcompact_end");
if(${IS_ENABLED_CHECK}){
  let __ccBlocking=owH(yW(F)-qH,v.options.mainLoopModel,v.getAppState().autoCompactWindow)?.isAtBlockingLimit;
  let __ccRes=await __tweakccApplyCollapses(F,v,CC,CS?.staged||[],!0,KiH(F),__ccBlocking);
  F=__ccRes.messages;
  CC=__ccRes.commits;
  CS={staged:__ccRes.staged};
  M={...M,messages:F,contextCollapseCommits:CC,contextCollapseSnapshot:CS};
  v?.setAppState?.(s=>({...s,contextCollapseCommits:CC,contextCollapseSnapshot:CS}));
}
${du9Match[1]}p4("query_autocompact_start");`;

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
  let __ccDrained=__tweakccDrainOverflow(F,CC,CS?.staged||[]);
  if(__ccDrained.committed>0){
    F=__ccDrained.messages;
    CS={staged:__ccDrained.staged};
    v?.setAppState?.(s=>({...s,contextCollapseCommits:CC,contextCollapseSnapshot:CS}));
    M={messages:F,toolUseContext:v,autoCompactTracking:void 0,maxOutputTokensRecoveryCount:E,hasAttemptedReactiveCompact:I,maxOutputTokensOverride:void 0,pendingToolUseSummary:void 0,stopHookActive:void 0,turnCount:B,contextCollapseCommits:CC,contextCollapseSnapshot:CS,transition:{reason:"collapse_drain_retry"}};
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
  const restorePatches: Array<[RegExp, string]> = [
    [
      /contextCollapseCommits:q\?\.contextCollapseCommits,contextCollapseSnapshot:q\?\.contextCollapseSnapshot,/g,
      'contextCollapseCommits:q?.contextCollapseCommits??[],contextCollapseSnapshot:q?.contextCollapseSnapshot??{staged:[]},',
    ],
    [
      /contextCollapseCommits:w\.filter\(\(k\)=>k\.sessionId===v\),contextCollapseSnapshot:M\?\.sessionId===v\?M:void 0,/g,
      'contextCollapseCommits:w.filter((k)=>k.sessionId===v),contextCollapseSnapshot:M?.sessionId===v?M:{staged:[]},',
    ],
    [
      /contextCollapseCommits:V\?L\.filter\(\(E\)=>E\.sessionId===V\):void 0,contextCollapseSnapshot:V&&Z\?\.sessionId===V\?Z:void 0/g,
      'contextCollapseCommits:V?L.filter((E)=>E.sessionId===V):[],contextCollapseSnapshot:V&&Z?.sessionId===V?Z:{staged:[]}',
    ],
    [
      /contextCollapseCommits:w\.filter\(\(Z\)=>Z\.sessionId===H\),contextCollapseSnapshot:M\?\.sessionId===H\?M:void 0/g,
      'contextCollapseCommits:w.filter((Z)=>Z.sessionId===H),contextCollapseSnapshot:M?.sessionId===H?M:{staged:[]}',
    ],
  ];

  for (const [pattern, replacement] of restorePatches) {
    newFile = newFile.replace(pattern, replacement);
  }

  showDiff(oldFile, newFile, 'Context Collapse Patch', 0, 100);
  return newFile;
};
