// Please see the note about writing patches in ./index

import { showDiff } from './index';

// Models to inject/make available.
// prettier-ignore
export const CUSTOM_MODELS: { value: string; label: string; description: string }[] = [
  { value: 'claude-opus-4-6',              label: 'Opus 4.6',             description: "Claude Opus 4.6 (February 2026)" },
  { value: 'claude-sonnet-4-6',            label: 'Sonnet 4.6',           description: "Claude Sonnet 4.6 (February 2026)" },
  { value: 'claude-haiku-4-5-20251001',    label: 'Haiku 4.5',            description: "Claude Haiku 4.5 (October 2025)" },
  { value: 'claude-opus-4-5-20251101',     label: 'Opus 4.5',             description: "Claude Opus 4.5 (November 2025)" },
  { value: 'claude-sonnet-4-5-20250929',   label: 'Sonnet 4.5',           description: "Claude Sonnet 4.5 (September 2025)" },
  { value: 'claude-opus-4-1-20250805',     label: 'Opus 4.1',             description: "Claude Opus 4.1 (August 2025)" },
  { value: 'claude-opus-4-20250514',      label: 'Opus 4',               description: "Claude Opus 4 (May 2025)" },
  { value: 'claude-sonnet-4-20250514',    label: 'Sonnet 4',             description: "Claude Sonnet 4 (May 2025)" },
  { value: 'claude-3-7-sonnet-20250219',  label: 'Sonnet 3.7',           description: "Claude 3.7 Sonnet (February 2025)" },
  { value: 'claude-3-5-sonnet-20241022',  label: 'Sonnet 3.5 (October)', description: "Claude 3.5 Sonnet (October 2024)" },
  { value: 'claude-3-5-haiku-20241022',   label: 'Haiku 3.5',            description: "Claude 3.5 Haiku (October 2024)" },
  { value: 'claude-3-5-sonnet-20240620',  label: 'Sonnet 3.5 (June)',    description: "Claude 3.5 Sonnet (June 2024)" },
  { value: 'claude-3-haiku-20240307',     label: 'Haiku 3',              description: "Claude 3 Haiku (March 2024)" },
  { value: 'claude-3-opus-20240229',      label: 'Opus 3',               description: "Claude 3 Opus (February 2024)" },
];

// Idempotency check - if our models are already present, skip
const alreadyPatched = (fileContents: string): boolean => {
  return CUSTOM_MODELS.some(m => fileContents.includes(`value:"${m.value}"`));
};

const findCustomModelListInsertionPoint = (
  fileContents: string
): { insertionIndex: number; modelListVar: string } | null => {
  // Check idempotency
  if (alreadyPatched(fileContents)) {
    return { insertionIndex: -1, modelListVar: '$' };
  }

  // Find function LoH which contains the model list building
  // The function signature is: function LoH(H=!1){let $=fw5(H),...
  const funcLoHMatch = fileContents.match(/function LoH\(H=!\d\)\{/);
  if (!funcLoHMatch || funcLoHMatch.index === undefined) {
    console.error(
      'patch: findCustomModelListInsertionPoint: failed to find function LoH'
    );
    return null;
  }

  const funcStart = funcLoHMatch.index + funcLoHMatch[0].length;
  // Find the end of function LoH by finding the next function or module boundary
  const afterFunc = fileContents.slice(funcStart, funcStart + 5000);
  const nextFuncMatch = afterFunc.match(/function [$\w]+\(/);
  const funcEnd =
    nextFuncMatch && nextFuncMatch.index !== undefined
      ? funcStart + nextFuncMatch.index
      : funcStart + afterFunc.length;

  // The model list variable is $ which is declared as let $=fw5(H)
  // We insert after the last $.push() statement in the function
  const funcBody = fileContents.slice(funcStart, funcEnd);

  // Find the last $.push( in the function body
  const lastPushIdx = funcBody.lastIndexOf('$.push(');
  if (lastPushIdx === -1) {
    console.error(
      'patch: findCustomModelListInsertionPoint: failed to find $.push in function'
    );
    return null;
  }

  // Find the semicolon after the push to get the end of the statement
  const afterPush = funcBody.slice(lastPushIdx);
  const semicolonIdx = afterPush.indexOf(';');
  if (semicolonIdx === -1) {
    console.error(
      'patch: findCustomModelListInsertionPoint: failed to find semicolon after push'
    );
    return null;
  }

  const insertionIndex = funcStart + lastPushIdx + semicolonIdx + 1;
  return { insertionIndex, modelListVar: '$' };
};

export const writeModelCustomizations = (oldFile: string): string | null => {
  if (oldFile.includes('"value":"claude-opus-4-6"')) {
    return oldFile;
  }

  const found = findCustomModelListInsertionPoint(oldFile);
  if (!found) return null;

  // Idempotency: if insertionIndex is -1, models are already present
  if (found.insertionIndex === -1) {
    return oldFile;
  }

  const { insertionIndex, modelListVar } = found;

  // Build the injection: push each custom model onto the list
  const inject = CUSTOM_MODELS.map(
    model => `${modelListVar}.push(${JSON.stringify(model)});`
  ).join('');

  const newFile =
    oldFile.slice(0, insertionIndex) + inject + oldFile.slice(insertionIndex);
  showDiff(oldFile, newFile, inject, insertionIndex, insertionIndex);
  return newFile;
};
