// Please see the note about writing patches in ./index

import { showDiff } from './index';

export const writePlanModeInterview = (oldFile: string): string | null => {
  const pattern =
    /function ([$\w]+)\(\)\{let ([$\w]+)=process\.env\.CLAUDE_CODE_PLAN_MODE_INTERVIEW_PHASE;if\([$\w]+\(\2\)\)return!0;if\([$\w]+\(\2\)\)return!1;return [$\w]+\("tengu_plan_mode_interview_phase",!1\)\}/;
  const match = oldFile.match(pattern);

  if (!match || match.index === undefined) {
    console.error(
      'patch: planModeInterview: failed to find interview gate function'
    );
    return null;
  }

  const replacement = `function ${match[1]}(){return!0}`;
  const startIndex = match.index;
  const endIndex = startIndex + match[0].length;
  const newFile =
    oldFile.slice(0, startIndex) + replacement + oldFile.slice(endIndex);

  showDiff(oldFile, newFile, replacement, startIndex, endIndex);
  return newFile;
};
