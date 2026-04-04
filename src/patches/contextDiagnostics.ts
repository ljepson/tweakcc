// Please see the note about writing patches in ./index

import { showDiff } from './index';

export const writeContextDiagnostics = (oldFile: string): string | null => {
  if (
    oldFile.includes('### Message Breakdown') &&
    oldFile.includes('#### Top Tools')
  ) {
    return oldFile;
  }

  // Match the destructuring to capture dynamic variable names for:
  //   skills, messageBreakdown, systemTools, systemPromptSections, accumulator
  const destructPattern =
    /skills:([$\w]+),messageBreakdown:([$\w]+),systemTools:([$\w]+),systemPromptSections:([$\w]+)\}=[$\w]+,([$\w]+)=`## Context Usage/;
  const destructMatch = oldFile.match(destructPattern);
  if (!destructMatch) {
    console.error(
      'patch: contextDiagnostics: failed to find /context destructuring'
    );
    return null;
  }
  const skillsVar = destructMatch[1];
  const msgBreakdownVar = destructMatch[2];
  const sysToolsVar = destructMatch[3];
  const sysPromptsVar = destructMatch[4];
  const accVar = destructMatch[5];

  // Match the skills section tail to capture formatter function names:
  //   sourceFormatter(J.source) and tokenFormatter(J.tokens)
  const skillTailPattern = new RegExp(
    escapeRegex(`for(let `) +
      '([$\\w]+)' +
      escapeRegex(` of ${skillsVar}.skillFrontmatter)${accVar}+=\`| \${`) +
      '[$\\w]+' +
      escapeRegex(`.name} | \${`) +
      '([$\\w]+)' +
      escapeRegex(`(`) +
      '[$\\w]+' +
      escapeRegex(`.source)} | \${`) +
      '([$\\w]+)' +
      escapeRegex(`(`) +
      '[$\\w]+' +
      escapeRegex(`.tokens)} |`)
  );
  const fmtMatch = oldFile.match(skillTailPattern);
  if (!fmtMatch) {
    console.error(
      'patch: contextDiagnostics: failed to find formatter functions in skills section'
    );
    return null;
  }
  const loopVar = fmtMatch[1];
  const srcFmtFn = fmtMatch[2];
  const tokFmtFn = fmtMatch[3];

  // Now find the block to replace: from "if(SKILLS&&SKILLS.tokens..." to "return ACC}"
  const startNeedle = `if(${skillsVar}&&${skillsVar}.tokens>0&&${skillsVar}.skillFrontmatter.length>0){${accVar}+=\`### Skills`;
  const startIndex = oldFile.indexOf(startNeedle);
  if (startIndex === -1) {
    console.error(
      'patch: contextDiagnostics: failed to find /context formatter tail'
    );
    return null;
  }
  const endNeedle = `return ${accVar}}`;
  const endIndex = oldFile.indexOf(endNeedle, startIndex);
  if (endIndex === -1) {
    console.error(
      'patch: contextDiagnostics: failed to find /context formatter return'
    );
    return null;
  }

  const Y = skillsVar;
  const w = msgBreakdownVar;
  const M = sysToolsVar;
  const D = sysPromptsVar;
  const j = accVar;
  const J = loopVar;
  const NXH = srcFmtFn;
  const O4 = tokFmtFn;

  const replacement =
    `if(${Y}&&${Y}.tokens>0&&${Y}.skillFrontmatter.length>0){${j}+=\`### Skills\\n\\n\`,${j}+=\`| Skill | Source | Tokens |\\n\`,${j}+=\`|-------|--------|--------|\\n\`;for(let ${J} of ${Y}.skillFrontmatter)${j}+=\`| \${${J}.name} | \${${NXH}(${J}.source)} | \${${O4}(${J}.tokens)} |\\n\`;${j}+=\`\\n\`}` +
    `if(${M}&&${M}.length>0){${j}+=\`### System Tools\\n\\n\`,${j}+=\`| Tool | Tokens |\\n\`,${j}+=\`|------|--------|\\n\`;for(let ${J} of ${M})${j}+=\`| \${${J}.name} | \${${O4}(${J}.tokens)} |\\n\`;${j}+=\`\\n\`}` +
    `if(${D}&&${D}.length>0){${j}+=\`### System Prompt Sections\\n\\n\`,${j}+=\`| Section | Tokens |\\n\`,${j}+=\`|---------|--------|\\n\`;for(let ${J} of ${D})${j}+=\`| \${${J}.name} | \${${O4}(${J}.tokens)} |\\n\`;${j}+=\`\\n\`}` +
    `if(${w}){${j}+=\`### Message Breakdown\\n\\n\`,${j}+=\`| Category | Tokens |\\n\`,${j}+=\`|----------|--------|\\n\`,${j}+=\`| Tool calls | \${${O4}(${w}.toolCallTokens)} |\\n\`,${j}+=\`| Tool results | \${${O4}(${w}.toolResultTokens)} |\\n\`,${j}+=\`| Attachments | \${${O4}(${w}.attachmentTokens)} |\\n\`,${j}+=\`| Assistant messages (non-tool) | \${${O4}(${w}.assistantMessageTokens)} |\\n\`,${j}+=\`| User messages (non-tool-result) | \${${O4}(${w}.userMessageTokens)} |\\n\`,${j}+=\`\\n\`;` +
    `if(${w}.toolCallsByType.length>0){${j}+=\`#### Top Tools\\n\\n\`,${j}+=\`| Tool | Call Tokens | Result Tokens |\\n\`,${j}+=\`|------|-------------|---------------|\\n\`;for(let ${J} of ${w}.toolCallsByType)${j}+=\`| \${${J}.name} | \${${O4}(${J}.callTokens)} | \${${O4}(${J}.resultTokens)} |\\n\`;${j}+=\`\\n\`}` +
    `if(${w}.attachmentsByType.length>0){${j}+=\`#### Top Attachments\\n\\n\`,${j}+=\`| Attachment | Tokens |\\n\`,${j}+=\`|------------|--------|\\n\`;for(let ${J} of ${w}.attachmentsByType)${j}+=\`| \${${J}.name} | \${${O4}(${J}.tokens)} |\\n\`;${j}+=\`\\n\`}}return ${j}}`;

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

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
