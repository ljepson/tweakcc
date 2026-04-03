/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, vi } from 'vitest';

const PROTECTED = path.join(os.homedir(), '.tweakcc');

function guardPath(label: string, p: unknown): void {
  if (typeof p === 'string' && p.startsWith(PROTECTED)) {
    throw new Error(
      `[TEST GUARD] ${label}(${p}) — mock fs.${label} to prevent writes to real config`
    );
  }
}

let writeFileSpy: any = null;
let mkdirSpy: any = null;

beforeEach(() => {
  const origWrite = (fs.writeFile as any).bind(fs);
  const origMkdir = (fs.mkdir as any).bind(fs);

  writeFileSpy = vi
    .spyOn(fs, 'writeFile')
    .mockImplementation((...args: any[]) => {
      guardPath('writeFile', args[0]);
      return origWrite(...args);
    });

  mkdirSpy = vi.spyOn(fs, 'mkdir').mockImplementation((...args: any[]) => {
    guardPath('mkdir', args[0]);
    return origMkdir(...args);
  });
});

afterEach(() => {
  writeFileSpy?.mockRestore();
  mkdirSpy?.mockRestore();
  writeFileSpy = null;
  mkdirSpy = null;
});
