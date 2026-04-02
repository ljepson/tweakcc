// Please see the note about writing patches in ./index

import { showDiff } from './index';

export const writeContextCollapse = (oldFile: string): string | null => {
  const injectLogic = `
globalThis.__tweakccContextCollapse = new class ContextCollapse {
  constructor() {
    this.sessionCommits = [];
    this.stagedSpans = [];
    this.isEnabled = false;
    this.currentRatio = 0;
  }

  init() {
    this.isEnabled = true;
  }

  reset() {
    this.isEnabled = false;
    this.sessionCommits = [];
    this.stagedSpans = [];
  }

  isContextCollapseEnabled() {
    return (globalThis.__tweakccConfig?.settings?.misc?.enableContextCollapse ?? false) && this.isEnabled;
  }

  restoreFromEntries(commits, snapshot) {
    this.sessionCommits = commits || [];
    this.stagedSpans = snapshot?.staged || [];
  }

  projectView(messages) {
    if (!this.isContextCollapseEnabled()) return messages;

    let res = [...messages];
    for (let c of this.sessionCommits) {
      let startIdx = res.findIndex(m => m.uuid === c.firstArchivedUuid);
      let endIdx = res.findIndex(m => m.uuid === c.lastArchivedUuid);
      if (startIdx !== -1 && endIdx !== -1 && endIdx >= startIdx) {
        let summaryMsg = {
          type: "system",
          subtype: "compact_boundary",
          content: c.summaryContent,
          level: "info",
          uuid: c.summaryUuid,
          timestamp: new Date().toISOString(),
          compactMetadata: { messagesSummarized: endIdx - startIdx + 1 }
        };
        res.splice(startIdx, endIdx - startIdx + 1, summaryMsg);
      }
    }

    if (this.currentRatio > 0.93) {
      for (let s of this.stagedSpans) {
        let startIdx = res.findIndex(m => m.uuid === s.startUuid);
        let endIdx = res.findIndex(m => m.uuid === s.endUuid);
        if (startIdx !== -1 && endIdx !== -1 && endIdx >= startIdx) {
          let summaryMsg = {
            type: "system",
            subtype: "compact_boundary",
            content: "[Staged for archive] " + s.summary,
            level: "info",
            uuid: "staged-" + Math.random().toString(36).substring(2),
            timestamp: new Date().toISOString(),
            compactMetadata: { messagesSummarized: endIdx - startIdx + 1, isStaged: true }
          };
          res.splice(startIdx, endIdx - startIdx + 1, summaryMsg);
        }
      }
    }

    return res;
  }

  async applyCollapsesIfNeeded(messages, toolUseContext, querySource) {
    if (!this.isContextCollapseEnabled()) return { messages: messages };

    let tokenCount = JSON.stringify(messages).length / 4;
    let windowSize = 200000;
    this.currentRatio = tokenCount / windowSize;

    if (this.currentRatio > 0.90) {
      if (this.currentRatio > 0.95 && this.stagedSpans.length > 0) {
        let span = this.stagedSpans.shift();
        let commit = {
          type: "marble-origami-commit",
          sessionId: "default",
          collapseId: Date.now().toString(),
          summaryUuid: Math.random().toString(36).substring(2),
          summaryContent: span.summary,
          summary: span.summary,
          firstArchivedUuid: span.startUuid,
          lastArchivedUuid: span.endUuid
        };
        this.sessionCommits.push(commit);
      } else {
        let firstUser = messages.findIndex(m => m.type === "user" && !m.isMeta);
        let lastAsst = messages.findIndex((m, i) => i > firstUser && m.type === "assistant");
        if (firstUser !== -1 && lastAsst !== -1) {
          let startUuid = messages[firstUser].uuid;
          if (!this.stagedSpans.some(s => s.startUuid === startUuid)) {
            this.stagedSpans.push({
              startUuid: startUuid,
              endUuid: messages[lastAsst].uuid,
              summary: "Collapsed older messages to save context.",
              risk: 0.1,
              stagedAt: Date.now()
            });
          }
        }
      }
    }

    return { messages: this.projectView(messages) };
  }

  recoverFromOverflow(messages, querySource) {
    if (this.stagedSpans.length > 0) {
      let span = this.stagedSpans.shift();
      let commit = {
        type: "marble-origami-commit",
        sessionId: "default",
        collapseId: Date.now().toString(),
        summaryUuid: Math.random().toString(36).substring(2),
        summaryContent: span.summary,
        summary: span.summary,
        firstArchivedUuid: span.startUuid,
        lastArchivedUuid: span.endUuid
      };
      this.sessionCommits.push(commit);
      return { messages: this.projectView(messages), committed: 1 };
    }

    return { messages: messages, committed: 0 };
  }
}();
globalThis.__tweakccContextCollapse.init();
`;

  let newFile = injectLogic + oldFile;

  const du9Pattern =
    /[$\w]+\("query_microcompact_end"\);(.*?)p4\("query_autocompact_start"\);/;
  const du9Match = newFile.match(du9Pattern);
  if (du9Match) {
    const du9Replacement = `p4("query_microcompact_end");F=(await globalThis.__tweakccContextCollapse.applyCollapsesIfNeeded(F,v,z)).messages;${du9Match[1]}p4("query_autocompact_start");`;
    newFile = newFile.replace(du9Match[0], du9Replacement);
  } else {
    console.error('patch: contextCollapse: failed to find DU9 injection site');
    return null;
  }

  const retryPattern =
    /if\(\([$\w]+\|\|[$\w]+\)&&rwH\)\{.*?transition:\{reason:"reactive_compact_retry"\}\};continue\}/;
  const retryMatch = newFile.match(retryPattern);
  if (retryMatch) {
    const drainLogic = `if((HH||KH)&&globalThis.__tweakccContextCollapse?.isContextCollapseEnabled()){let drained=globalThis.__tweakccContextCollapse.recoverFromOverflow(F,z);if(drained.committed>0){F=drained.messages;M={messages:F,toolUseContext:v,autoCompactTracking:void 0,maxOutputTokensRecoveryCount:E,hasAttemptedReactiveCompact:I,maxOutputTokensOverride:void 0,pendingToolUseSummary:void 0,stopHookActive:void 0,turnCount:B,transition:{reason:"collapse_drain_retry"}};continue}}`;
    newFile = newFile.replace(retryMatch[0], drainLogic + retryMatch[0]);
  } else {
    console.warn(
      'patch: contextCollapse: failed to find 413 retry site (skipping drain logic)'
    );
  }

  const autoCompactPattern = /async function v_7\([A-Za-z0-9_$,]*\)\{/;
  const autoCompactMatch = newFile.match(autoCompactPattern);
  if (autoCompactMatch) {
    const acReplacement =
      autoCompactMatch[0] +
      'if(globalThis.__tweakccContextCollapse?.isContextCollapseEnabled()) return {compactionResult:undefined,consecutiveFailures:undefined,consecutiveRapidRefills:undefined,rapidRefillBreakerTripped:false};';
    newFile = newFile.replace(autoCompactMatch[0], acReplacement);
  } else {
    console.error('patch: contextCollapse: failed to find v_7');
    return null;
  }

  const hcPattern =
    /function hc\(([$\w]+)\)\{let ([$\w]+)=[$\w]+\(\);if\(\1\.customTitle\)\2\.currentSessionTitle\?\?=\1\.customTitle;/;
  const hcMatch = newFile.match(hcPattern);
  if (hcMatch) {
    const hcReplacement =
      hcMatch[0] +
      'globalThis.__tweakccContextCollapse.restoreFromEntries(H.contextCollapseCommits, H.contextCollapseSnapshot);';
    newFile = newFile.replace(hcMatch[0], hcReplacement);
  }

  showDiff(oldFile, newFile, 'Context Collapse Implementation', 0, 100);
  return newFile;
};
