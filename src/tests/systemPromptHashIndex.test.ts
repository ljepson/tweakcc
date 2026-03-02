import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('systemPromptHashIndex recovery', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tweakcc-hash-index-'));
    process.env.TWEAKCC_CONFIG_DIR = tmpDir;
    vi.resetModules();
  });

  afterEach(async () => {
    delete process.env.TWEAKCC_CONFIG_DIR;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('recovers malformed applied hash JSON with trailing garbage', async () => {
    const filePath = path.join(tmpDir, 'systemPromptAppliedHashes.json');
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.writeFile(
      filePath,
      '{"tool-parameter-computer-action": null}\nmeter-computer-action": null\n}',
      'utf8'
    );

    const mod = await import('../systemPromptHashIndex');
    const result = await mod.readAppliedHashIndex();

    expect(result).toEqual({
      'tool-parameter-computer-action': null,
    });

    const repaired = JSON.parse(await fs.readFile(filePath, 'utf8'));
    expect(repaired).toEqual({
      'tool-parameter-computer-action': null,
    });
  });
});
