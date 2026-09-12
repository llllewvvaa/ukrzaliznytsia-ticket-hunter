import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export class LockHeldError extends Error {
  constructor(
    public readonly pid: number,
    public readonly file: string,
  ) {
    super(`another instance is running (pid ${pid}, lock ${file})`);
    this.name = 'LockHeldError';
  }
}

export interface Lock {
  file: string;
  release: () => void;
}

export function isProcessAlive(
  pid: number,
  kill: (pid: number, signal: number) => void = process.kill,
): boolean {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

export function readLockPid(file: string): number | null {
  try {
    const raw = readFileSync(file, 'utf-8').trim();
    const pid = Number(raw);
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
}

export function acquireLock(file: string, pid = process.pid): Lock {
  const existing = readLockPid(file);
  if (existing !== null && existing !== pid && isProcessAlive(existing)) {
    throw new LockHeldError(existing, file);
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, String(pid), 'utf-8');
  return {
    file,
    release: () => {
      if (readLockPid(file) === pid) rmSync(file, { force: true });
    },
  };
}
