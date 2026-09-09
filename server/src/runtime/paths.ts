import { homedir } from 'node:os';
import { join } from 'node:path';

export function dataDir(): string {
  return process.env.UZ_DATA_DIR ?? join(homedir(), '.uz-watch');
}

export function dbPath(): string {
  return process.env.UZ_DB ?? join(dataDir(), 'uz.sqlite');
}

export function profileDir(): string {
  return process.env.UZ_PROFILE_DIR ?? join(dataDir(), 'chrome-profile');
}
