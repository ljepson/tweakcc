import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const indexPath = path.join(import.meta.dirname, 'index.ts');
const indexSource = fs.readFileSync(indexPath, 'utf8');

const BRITTLE_PATCH_IDS = [
  'reactive-compact',
  'context-collapse',
  'verification-agent',
  'auto-launch-verification-agent',
  'kairos',
];

describe('brittle patch version guards', () => {
  it('requires supportedVersions for brittle minified-name patches', () => {
    for (const patchId of BRITTLE_PATCH_IDS) {
      const patchBlock = indexSource.match(
        new RegExp(String.raw`\{[\s\S]*?id:\s*'${patchId}'[\s\S]*?\}`, 'm')
      );

      expect(
        patchBlock,
        `missing patch definition for ${patchId}`
      ).toBeTruthy();
      expect(
        patchBlock?.[0],
        `${patchId} should declare supportedVersions`
      ).toContain("supportedVersions: ['2.1.89']");
    }
  });
});
