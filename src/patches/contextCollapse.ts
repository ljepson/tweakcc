// Please see the note about writing patches in ./index

import { showDiff } from './index';

export const writeContextCollapse = (oldFile: string): string | null => {
  const injectLogic = `
globalThis.__tweakccContextCollapse = new class ContextCollapse {
  constructor() {
    this.sessionCommits = [];
  }

  isContextCollapseEnabled() {
    return globalThis.__tweakccConfig?.settings?.misc?.enableContextCollapse ?? false;
  }

  projectView(messages) {
    if (!this.isContextCollapseEnabled() || this.sessionCommits.length === 0) return messages;
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
    return res;
  }

  async applyCollapsesIfNeeded(messages, toolUseContext, querySource) {
    if (!this.isContextCollapseEnabled()) return { messages };
    
    // Estimate tokens
    let tokenCount = JSON.stringify(messages).length / 4;
    let windowSize = 200000;
    let ratio = tokenCount / windowSize;

    if (ratio > 0.90) {
      let firstUser = -1;
      let lastAsst = -1;
      let count = 0;
      for (let i=0; i<messages.length; i++) {
        if (messages[i].type === "user" && firstUser === -1 && !messages[i].isMeta) firstUser = i;
        if (messages[i].type === "assistant" && firstUser !== -1) {
          count++;
          if (count === 5) {
             lastAsst = i;
             break;
          }
        }
      }
      
      if (firstUser !== -1 && lastAsst !== -1) {
        let summary = "Collapsed messages to save context.";
        let commit = {
          type: "marble-origami-commit",
          sessionId: toolUseContext.agentId || "default",
          collapseId: Date.now().toString(),
          summaryUuid: Date.now().toString(),
          summaryContent: summary,
          summary: summary,
          firstArchivedUuid: messages[firstUser].uuid,
          lastArchivedUuid: messages[lastAsst].uuid
        };
        this.sessionCommits.push(commit);
        messages = this.projectView(messages);
      }
    }
    return { messages };
  }

  recoverFromOverflow(messages, querySource) {
    return { messages, committed: 0 };
  }

  isWithheldPromptTooLong(message) {
    return false;
  }
}();
`;

  // 1. Inject global class at top
  let newFile = injectLogic + oldFile;

  // 2. Patch DU9 before autocompact
  const du9Pattern =
    /p4\("query_microcompact_end"\);let ([$\\w]+)=\$_\\([$\\w]+\\([$\\w]+,[$\\w]+\\)\\);p4\("query_autocompact_start"\);/;
  const du9Match = newFile.match(du9Pattern);
  if (!du9Match) {
    console.error(
      'patch: contextCollapse: failed to find DU9 microcompact_end'
    );
    return null;
  }
  const sysPromptVar = du9Match[1];
  const sysPromptRHS = du9Match[2];
  const du9Replacement = `p4("query_microcompact_end");F=(await globalThis.__tweakccContextCollapse.applyCollapsesIfNeeded(F,v,z)).messages;let ${sysPromptVar}=${sysPromptRHS};p4("query_autocompact_start");`;

  newFile = newFile.replace(du9Match[0], du9Replacement);

  // 3. Patch autocompact (v_7) to return early if enabled
  const autoCompactPattern = /async function v_7\([A-Za-z0-9_$,]*\)\{/;
  const autoCompactMatch = newFile.match(autoCompactPattern);
  if (!autoCompactMatch) {
    console.error('patch: contextCollapse: failed to find v_7');
    return null;
  }

  const acReplacement =
    autoCompactMatch[0] +
    'if(globalThis.__tweakccContextCollapse?.isContextCollapseEnabled()) return {compactionResult:undefined,consecutiveFailures:undefined,consecutiveRapidRefills:undefined,rapidRefillBreakerTripped:false};';
  newFile = newFile.replace(autoCompactMatch[0], acReplacement);

  // 4. Project view in sessionRestore? We just do it for API view which is already handled if we replace F.

  showDiff(oldFile, newFile, 'Context Collapse Implementation', 0, 100);
  return newFile;
};
