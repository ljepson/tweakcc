// Please see the note about writing patches in ./index

import { showDiff } from './index';

export const writeMicrocompactFallback = (oldFile: string): string | null => {
  if (
    oldFile.includes(
      'globalThis.__tweakccConfig?.settings.misc?.enableTimeBasedMicrocompact??false'
    ) &&
    oldFile.includes('[TIME-BASED MC]') &&
    oldFile.includes(
      "{type:'system',subtype:'informational',content:JOf,level:'info',uuid:vG.randomUUID(),timestamp:new Date().toISOString()}"
    )
  ) {
    return oldFile;
  }

  // Step 1: Patch W7K to use our setting instead of just the GB feature gate
  // Binary: var W7K=G(()=>{e8();Gg4={enabled:!1,gapThresholdMinutes:60,keepRecent:5}});
  const w7kPattern =
    /var ([$\w]+)=G\(\(\)=>{e8\(\);([$\w]+)={enabled:!1,gapThresholdMinutes:60,keepRecent:5}}\);/;
  const w7kMatch = oldFile.match(w7kPattern);

  if (!w7kMatch || w7kMatch.index === undefined) {
    console.error('patch: microcompactFallback: failed to find W7K definition');
    return null;
  }

  const w7kVar = w7kMatch[1];
  const g4Var = w7kMatch[2];

  // Step 2: Patch Ng4 to inject the system message nudge
  // Original ends with: ...CTH(),qr(),{messages:w}}
  // We want to add: ,{messages:[...w,{type:'system',subtype:'informational',content:JOf,level:'info',uuid:vG.randomUUID(),timestamp:new Date().toISOString()}]}}
  // Pattern needs to be more flexible about what comes before the return.
  const ng4Pattern =
    /function ([$\w]+)\([$\w]+,[$\w]+\)\{.{10,2000}CTH\(\),qr\(\),{messages:([$\w]+)}}/g;

  const ng4Matches = Array.from(oldFile.matchAll(ng4Pattern));
  // Find the one that has the log string or similar markers
  const ng4Match = ng4Matches.find(
    m =>
      m[0].includes('tengu_time_based_microcompact') ||
      m[0].includes('TIME-BASED MC')
  );

  if (!ng4Match || ng4Match.index === undefined) {
    console.error(
      'patch: microcompactFallback: failed to find Ng4 implementation'
    );
    return null;
  }

  const messagesVar = ng4Match[2];

  let newFile = oldFile;

  // Replace W7K
  const w7kReplacement = `var ${w7kVar}=G(()=>{e8();${g4Var}={enabled:globalThis.__tweakccConfig?.settings.misc?.enableTimeBasedMicrocompact??false,gapThresholdMinutes:60,keepRecent:5}});`;
  newFile = newFile.replace(w7kMatch[0], w7kReplacement);

  // Replace Ng4 return
  const ng4Old = `CTH(),qr(),{messages:${messagesVar}}`;
  const ng4New = `CTH(),qr(),{messages:[...${messagesVar},{type:'system',subtype:'informational',content:JOf,level:'info',uuid:vG.randomUUID(),timestamp:new Date().toISOString()}]}`;

  if (!newFile.includes(ng4Old)) {
    console.error(
      'patch: microcompactFallback: failed to find Ng4 return statement in modified file'
    );
    return null;
  }

  newFile = newFile.replace(ng4Old, ng4New);

  showDiff(
    oldFile,
    newFile,
    'Microcompact Fallback (Nudge + Enablement)',
    w7kMatch.index,
    w7kMatch.index + w7kMatch[0].length
  );

  return newFile;
};
