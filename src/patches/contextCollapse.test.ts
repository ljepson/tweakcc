import { describe, expect, it, vi } from 'vitest';
import { writeContextCollapse } from './contextCollapse';

// Minimal mock bundle with DU9 query state machine pattern and native-style
// resume/transcript object returns that already carry contextCollapse fields.
const mockBundle = `
let M={messages:H.messages,toolUseContext:H.toolUseContext,maxOutputTokensOverride:H.maxOutputTokensOverride,autoCompactTracking:void 0,stopHookActive:void 0,maxOutputTokensRecoveryCount:0,hasAttemptedReactiveCompact:!1,turnCount:1,pendingToolUseSummary:void 0,transition:void 0};
let{toolUseContext:v}=M,{messages:k,autoCompactTracking:V,maxOutputTokensRecoveryCount:E,hasAttemptedReactiveCompact:I,maxOutputTokensOverride:h,pendingToolUseSummary:x,stopHookActive:b,turnCount:B}=M,p=runQuery(k);
p4("query_microcompact_end");let processed=processMessages(F);p4("query_autocompact_start");
async function autoCompactFn(ctx,messages,opts){let result=await compact(messages);return{compactionResult:result,consecutiveFailures:0,consecutiveRapidRefills:0,rapidRefillBreakerTripped:!1};}
return K.push(...O),{messages:K,turnInterruptionState:z.turnInterruptionState,deferredToolUse:A,fileHistorySnapshots:q?.fileHistorySnapshots,attributionSnapshots:q?.attributionSnapshots,contentReplacements:q?.contentReplacements,contextCollapseCommits:q?.contextCollapseCommits,contextCollapseSnapshot:q?.contextCollapseSnapshot,sessionId:_,agentName:q?.agentName,agentColor:q?.agentColor,agentSetting:q?.agentSetting,customTitle:q?.customTitle,tag:q?.tag,mode:q?.mode,worktreeSession:q?.worktreeSession,prNumber:q?.prNumber,prUrl:q?.prUrl,prRepository:q?.prRepository,fullPath:q?.fullPath}
return{...b_6(X,0,L,Z,Hi$(O,X),W,H,$i$(Y,X),void 0,j.get(v)??[]),contextCollapseCommits:w.filter((k)=>k.sessionId===v),contextCollapseSnapshot:M?.sessionId===v?M:void 0,worktreeSession:P.has(v)?P.get(v):void 0}
return{...H,messages:UyH(k),firstPrompt:U_6(k),messageCount:c_6(k),summary:v?K.get(v.uuid):H.summary,customTitle:V?_.get(V):H.customTitle,tag:V?f.get(V):H.tag,agentName:V?A.get(V):H.agentName,agentColor:V?z.get(V):H.agentColor,agentSetting:V?O.get(V):H.agentSetting,mode:V?D.get(V):H.mode,worktreeSession:V&&j.has(V)?j.get(V):H.worktreeSession,prNumber:V?Y.get(V):H.prNumber,prUrl:V?w.get(V):H.prUrl,prRepository:V?M.get(V):H.prRepository,gitBranch:v?.gitBranch??H.gitBranch,isSidechain:k[0]?.isSidechain??H.isSidechain,teamName:k[0]?.teamName??H.teamName,sessionKind:k[0]?.sessionKind??H.sessionKind,leafUuid:v?.uuid??H.leafUuid,fileHistorySnapshots:Hi$(P,k),attributionSnapshots:$i$(J,k),contentReplacements:V?X.get(V)??[]:H.contentReplacements,contextCollapseCommits:V?L.filter((E)=>E.sessionId===V):void 0,contextCollapseSnapshot:V&&Z?.sessionId===V?Z:void 0}
return{...b_6(j,0,P,J,Hi$(z,j),X,gv(H),$i$(O,j),L,Y.get(H)??[]),worktreeSession:A.get(H),contextCollapseCommits:w.filter((Z)=>Z.sessionId===H),contextCollapseSnapshot:M?.sessionId===H?M:void 0}
`;

// Mock bundle with 413 retry pattern
const mockBundleWithRetry = `
let M={messages:H.messages,toolUseContext:H.toolUseContext,maxOutputTokensOverride:H.maxOutputTokensOverride,autoCompactTracking:void 0,stopHookActive:void 0,maxOutputTokensRecoveryCount:0,hasAttemptedReactiveCompact:!1,turnCount:1,pendingToolUseSummary:void 0,transition:void 0};
let{toolUseContext:v}=M,{messages:k,autoCompactTracking:V,maxOutputTokensRecoveryCount:E,hasAttemptedReactiveCompact:I,maxOutputTokensOverride:h,pendingToolUseSummary:x,stopHookActive:b,turnCount:B}=M,p=runQuery(k);
p4("query_microcompact_end");let processed=processMessages(F);p4("query_autocompact_start");
if((HH||KH)&&retryVar){M={messages:F,toolUseContext:v,autoCompactTracking:void 0,maxOutputTokensRecoveryCount:E,hasAttemptedReactiveCompact:!0,maxOutputTokensOverride:void 0,pendingToolUseSummary:void 0,stopHookActive:void 0,turnCount:B,transition:{reason:"reactive_compact_retry"}};continue}
async function autoCompactFn(ctx,messages,opts){let result=await compact(messages);return{compactionResult:result,consecutiveFailures:0,consecutiveRapidRefills:0,rapidRefillBreakerTripped:!1};}
return K.push(...O),{messages:K,turnInterruptionState:z.turnInterruptionState,deferredToolUse:A,fileHistorySnapshots:q?.fileHistorySnapshots,attributionSnapshots:q?.attributionSnapshots,contentReplacements:q?.contentReplacements,contextCollapseCommits:q?.contextCollapseCommits,contextCollapseSnapshot:q?.contextCollapseSnapshot,sessionId:_,agentName:q?.agentName,agentColor:q?.agentName,agentSetting:q?.agentSetting,customTitle:q?.customTitle,tag:q?.tag,mode:q?.mode,worktreeSession:q?.worktreeSession,prNumber:q?.prNumber,prUrl:q?.prUrl,prRepository:q?.prRepository,fullPath:q?.fullPath}
`;

describe('writeContextCollapse', () => {
  describe('helper injection', () => {
    it('should inject the project view helper', () => {
      const result = writeContextCollapse(mockBundle);
      expect(result).toContain('__tweakccProjectCollapseView');
    });

    it('should resolve context limit inside the apply helper', () => {
      const result = writeContextCollapse(mockBundle);
      expect(result).toContain('let limit=+v?.getAppState?.()?.contextLimit;');
      expect(result).toContain('CLAUDE_CODE_CONTEXT_LIMIT');
    });

    it('should inject the apply collapses helper', () => {
      const result = writeContextCollapse(mockBundle);
      expect(result).toContain('__tweakccApplyCollapses');
    });

    it('should inject the drain overflow helper', () => {
      const result = writeContextCollapse(mockBundle);
      expect(result).toContain('__tweakccDrainOverflow');
    });
  });

  describe('DU9 state machine hook', () => {
    it('should extend DU9 local state with collapse fields', () => {
      const result = writeContextCollapse(mockBundle);
      expect(result).toContain(
        'contextCollapseCommits:H.toolUseContext.getAppState?.().contextCollapseCommits??[]'
      );
      expect(result).toContain(
        'contextCollapseSnapshot:H.toolUseContext.getAppState?.().contextCollapseSnapshot??{staged:[]}'
      );
      expect(result).toContain(
        'contextCollapseCommits:CC,contextCollapseSnapshot:CS'
      );
    });

    it('should hook into query_microcompact_end -> query_autocompact_start', () => {
      const result = writeContextCollapse(mockBundle);
      expect(result).toContain(
        '__tweakccConfig?.settings?.misc?.enableContextCollapse'
      );
      expect(result).toContain(
        'let __ccBlocking=owH(yW(F)-qH,v.options.mainLoopModel,v.getAppState().autoCompactWindow)?.isAtBlockingLimit;'
      );
      expect(result).toContain('__ccRes=await __tweakccApplyCollapses');
      expect(result).toContain('KiH(F),__ccBlocking');
      expect(result).toContain('CC=__ccRes.commits;');
      expect(result).toContain('CS={staged:__ccRes.staged};');
      expect(result).toContain(
        'M={...M,messages:F,contextCollapseCommits:CC,contextCollapseSnapshot:CS};'
      );
    });

    it('should persist collapse state to app state', () => {
      const result = writeContextCollapse(mockBundle);
      expect(result).toContain('contextCollapseCommits');
      expect(result).toContain('contextCollapseSnapshot');
    });

    it('should return null if DU9 pattern not found', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const result = writeContextCollapse('no du9 pattern here');
      expect(result).toBeNull();
      vi.restoreAllMocks();
    });
  });

  describe('overflow drain', () => {
    it('should preserve staged state when draining overflow', () => {
      const result = writeContextCollapse(mockBundleWithRetry);
      expect(result).toContain('return{messages:F,committed:0,staged}');
      expect(result).toContain(
        'return{messages:__tweakccProjectCollapseView(F,commits,staged,1),committed:1,staged}'
      );
      expect(result).toContain('CS={staged:__ccDrained.staged};');
      expect(result).toContain(
        'contextCollapseCommits:CC,contextCollapseSnapshot:CS,transition:{reason:"collapse_drain_retry"}'
      );
    });
  });

  describe('autoCompact disable', () => {
    it('should disable autoCompact when context collapse is enabled', () => {
      const result = writeContextCollapse(mockBundle);
      expect(result).toContain(
        'if(globalThis.__tweakccConfig?.settings?.misc?.enableContextCollapse)'
      );
      expect(result).toContain('compactionResult:void 0');
    });
  });

  describe('resume state defaults', () => {
    it('should default resume object collapse fields', () => {
      const result = writeContextCollapse(mockBundle);
      expect(result).toContain(
        'contextCollapseCommits:q?.contextCollapseCommits??[]'
      );
      expect(result).toContain(
        'contextCollapseSnapshot:q?.contextCollapseSnapshot??{staged:[]}'
      );
    });

    it('should default transcript/session collapse fields', () => {
      const result = writeContextCollapse(mockBundle);
      expect(result).toContain(
        'contextCollapseSnapshot:M?.sessionId===v?M:{staged:[]}'
      );
      expect(result).toContain(
        'contextCollapseCommits:V?L.filter((E)=>E.sessionId===V):[]'
      );
      expect(result).toContain(
        'contextCollapseSnapshot:V&&Z?.sessionId===V?Z:{staged:[]}'
      );
      expect(result).toContain(
        'contextCollapseSnapshot:M?.sessionId===H?M:{staged:[]}'
      );
    });
  });

  describe('idempotency', () => {
    it('should return unchanged if already patched', () => {
      const alreadyPatched = mockBundle.replace(
        'let M={messages:H.messages,toolUseContext:H.toolUseContext,maxOutputTokensOverride:H.maxOutputTokensOverride,autoCompactTracking:void 0,stopHookActive:void 0,maxOutputTokensRecoveryCount:0,hasAttemptedReactiveCompact:!1,turnCount:1,pendingToolUseSummary:void 0,transition:void 0};',
        'function __tweakccProjectCollapseView(){}let M={messages:H.messages,toolUseContext:H.toolUseContext,maxOutputTokensOverride:H.maxOutputTokensOverride,autoCompactTracking:void 0,stopHookActive:void 0,maxOutputTokensRecoveryCount:0,hasAttemptedReactiveCompact:!1,turnCount:1,pendingToolUseSummary:void 0,transition:void 0,contextCollapseCommits:H.toolUseContext.getAppState?.().contextCollapseCommits??[],contextCollapseSnapshot:H.toolUseContext.getAppState?.().contextCollapseSnapshot??{staged:[]}};'
      );
      const result = writeContextCollapse(alreadyPatched);
      expect(result).toBe(alreadyPatched);
    });
  });

  describe('compact_boundary messages', () => {
    it('should use native compact_boundary message structure', () => {
      const result = writeContextCollapse(mockBundle);
      expect(result).toContain('type:"system"');
      expect(result).toContain('subtype:"compact_boundary"');
      expect(result).toContain('compactMetadata');
      expect(result).toContain('preservedSegment');
    });
  });
});
