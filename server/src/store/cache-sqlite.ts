import type { Db } from './db.js';
import type { CacheEntry, ResponseCache } from '../net/cache.js';

export function createSqliteCache(db: Db): ResponseCache {
  const read = db.prepare(
    'select body, status, hash, fetched_at as fetchedAt, expires_at as expiresAt from response_cache where key = ?',
  );
  const write = db.prepare(
    'insert or replace into response_cache (key, body, status, hash, fetched_at, expires_at) values (?, ?, ?, ?, ?, ?)',
  );
  const drop = db.prepare('delete from response_cache where key = ?');

  return {
    get(key, now) {
      const row = read.get(key) as unknown as (CacheEntry & { expiresAt: number }) | undefined;
      if (!row) return undefined;
      if (now >= row.expiresAt) {
        drop.run(key);
        return undefined;
      }
      return { body: row.body, status: row.status, hash: row.hash, fetchedAt: row.fetchedAt };
    },
    set(key, entry, ttlMs) {
      write.run(key, entry.body, entry.status, entry.hash, entry.fetchedAt, entry.fetchedAt + ttlMs);
    },
  };
}

export function pruneCache(db: Db, now: number): number {
  const before = (db.prepare('select count(*) as n from response_cache').get() as unknown as { n: number }).n;
  db.prepare('delete from response_cache where expires_at <= ?').run(now);
  const after = (db.prepare('select count(*) as n from response_cache').get() as unknown as { n: number }).n;
  return before - after;
}
