import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LockHeldError, acquireLock, isProcessAlive, readLockPid } from './lock.js';

describe('single instance lock', () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'uz-lock-'));
    file = join(dir, 'daemon.lock');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('writes the pid it holds', () => {
    acquireLock(file, 4242);
    expect(readLockPid(file)).toBe(4242);
  });

  it('refuses to start beside a live instance', () => {
    writeFileSync(file, String(process.pid));
    expect(() => acquireLock(file, process.pid + 1)).toThrow(LockHeldError);
  });

  it('takes over a lock left by a dead process', () => {
    writeFileSync(file, '999999999');
    expect(() => acquireLock(file, 1234)).not.toThrow();
    expect(readLockPid(file)).toBe(1234);
  });

  it('releases only its own lock', () => {
    const lock = acquireLock(file, 1234);
    writeFileSync(file, '5678');
    lock.release();
    expect(readLockPid(file)).toBe(5678);
  });

  it('reads a live process correctly', () => {
    expect(isProcessAlive(process.pid)).toBe(true);
    expect(isProcessAlive(-1)).toBe(false);
  });
});
