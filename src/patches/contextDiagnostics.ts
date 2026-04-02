// Please see the note about writing patches in ./index

import { showDiff } from './index';

export const writeContextDiagnostics = (oldFile: string): string | null => {
  if (
    oldFile.includes('### Message Breakdown') &&
    oldFile.includes('#### Top Tools')
  ) {
    return oldFile;
  }

  const startNeedle =
    'if(Y&&Y.tokens>0&&Y.skillFrontmatter.length>0){j+=`### Skills';
  const startIndex = oldFile.indexOf(startNeedle);
  if (startIndex === -1) {
    console.error(
      'patch: contextDiagnostics: failed to find /context formatter tail'
    );
    return null;
  }
  const endNeedle = 'return j}';
  const endIndex = oldFile.indexOf(endNeedle, startIndex);
  if (endIndex === -1) {
    console.error(
      'patch: contextDiagnostics: failed to find /context formatter return'
    );
    return null;
  }

  const replacement =
    'if(Y&&Y.tokens>0&&Y.skillFrontmatter.length>0){j+=`### Skills\\n\\n`,j+=`| Skill | Source | Tokens |\\n`,j+=`|-------|--------|--------|\\n`;for(let J of Y.skillFrontmatter)j+=`| ${J.name} | ${NXH(J.source)} | ${O4(J.tokens)} |\\n`;j+=`\\n`}if(M&&M.length>0){j+=`### System Tools\\n\\n`,j+=`| Tool | Tokens |\\n`,j+=`|------|--------|\\n`;for(let J of M)j+=`| ${J.name} | ${O4(J.tokens)} |\\n`;j+=`\\n`}if(D&&D.length>0){j+=`### System Prompt Sections\\n\\n`,j+=`| Section | Tokens |\\n`,j+=`|---------|--------|\\n`;for(let J of D)j+=`| ${J.name} | ${O4(J.tokens)} |\\n`;j+=`\\n`}if(w){j+=`### Message Breakdown\\n\\n`,j+=`| Category | Tokens |\\n`,j+=`|----------|--------|\\n`,j+=`| Tool calls | ${O4(w.toolCallTokens)} |\\n`,j+=`| Tool results | ${O4(w.toolResultTokens)} |\\n`,j+=`| Attachments | ${O4(w.attachmentTokens)} |\\n`,j+=`| Assistant messages (non-tool) | ${O4(w.assistantMessageTokens)} |\\n`,j+=`| User messages (non-tool-result) | ${O4(w.userMessageTokens)} |\\n`,j+=`\\n`;if(w.toolCallsByType.length>0){j+=`#### Top Tools\\n\\n`,j+=`| Tool | Call Tokens | Result Tokens |\\n`,j+=`|------|-------------|---------------|\\n`;for(let J of w.toolCallsByType)j+=`| ${J.name} | ${O4(J.callTokens)} | ${O4(J.resultTokens)} |\\n`;j+=`\\n`}if(w.attachmentsByType.length>0){j+=`#### Top Attachments\\n\\n`,j+=`| Attachment | Tokens |\\n`,j+=`|------------|--------|\\n`;for(let J of w.attachmentsByType)j+=`| ${J.name} | ${O4(J.tokens)} |\\n`;j+=`\\n`}}return j}';

  const newFile =
    oldFile.slice(0, startIndex) +
    replacement +
    oldFile.slice(endIndex + endNeedle.length);
  showDiff(
    oldFile,
    newFile,
    replacement,
    startIndex,
    endIndex + endNeedle.length
  );
  return newFile;
};
