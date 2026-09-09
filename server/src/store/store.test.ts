import { rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import { upsertProbe } from '../watch/probe-store.js';
import { openDb, schemaVersion, type Db } from './db.js';
import { SCHEMA_VERSION } from './schema.js';
import { budgetReport, createSqliteRequestLog } from './log-sqlite.js';
import { createSqliteCache, pruneCache } from './cache-sqlite.js';

describe('sqlite store', () => {
  let db: Db;

  beforeEach(() => {
    db = openDb(':memory:');
  });

  it('creates the schema and stamps its version', () => {
    expect(schemaVersion(db)).toBe(SCHEMA_VERSION);
  });

  it('persists request log rows and reads them back', () => {
    const log = createSqliteRequestLog(db);
    log.record({ ts: 10, path: '/v3/trips', status: 200, ms: 120, cacheHit: false, bytes: 1000 });
    log.record({ ts: 20, path: '/v3/trips', status: 200, ms: 0, cacheHit: true, bytes: 1000 });
    expect(log.entries()).toHaveLength(2);
    expect(log.entries()[1]!.cacheHit).toBe(true);
  });

  it('reports the budget with a per-hour rate over the asked window', () => {
    const log = createSqliteRequestLog(db);
    log.record({ ts: 0, path: '/a', status: 200, ms: 5, cacheHit: false, bytes: 10 });
    log.record({ ts: 1_800_000, path: '/a', status: 200, ms: 5, cacheHit: false, bytes: 10 });
    log.record({ ts: 1_800_000, path: '/a', status: 200, ms: 0, cacheHit: true, bytes: 10 });
    const report = budgetReport(db, 0, 3_600_000);
    expect(report).toMatchObject({ total: 3, network: 2, cached: 1 });
    expect(Math.round(report.perHour)).toBe(2);
  });

  it('does not inflate the rate when the window has an idle tail', () => {
    const log = createSqliteRequestLog(db);
    for (let i = 0; i < 10; i += 1) {
      log.record({ ts: i * 1_000, path: '/a', status: 200, ms: 1, cacheHit: false, bytes: 1 });
    }
    const burstOnly = budgetReport(db, 0, 10_000);
    const withIdleTail = budgetReport(db, 0, 3_600_000);
    expect(burstOnly.perHour).toBeGreaterThan(withIdleTail.perHour);
    expect(Math.round(withIdleTail.perHour)).toBe(10);
  });

  it('serves cached bodies until the ttl runs out', () => {
    const cache = createSqliteCache(db);
    cache.set('/v3/trips', { body: '{}', status: 200, hash: 'abc', fetchedAt: 1_000 }, 60_000);
    expect(cache.get('/v3/trips', 30_000)?.hash).toBe('abc');
    expect(cache.get('/v3/trips', 61_001)).toBeUndefined();
  });

  it('prunes expired rows', () => {
    const cache = createSqliteCache(db);
    cache.set('/a', { body: '{}', status: 200, hash: 'a', fetchedAt: 0 }, 1_000);
    cache.set('/b', { body: '{}', status: 200, hash: 'b', fetchedAt: 0 }, 100_000);
    expect(pruneCache(db, 50_000)).toBe(1);
  });

  it('migrates a legacy probe table to the transfer-aware key', () => {
    const file = `/tmp/uz-watch-legacy-${process.pid}.sqlite`;
    rmSync(file, { force: true });
    const legacy = new DatabaseSync(file);
    legacy.exec(`create table probe (
      from_id integer not null,
      to_id integer not null,
      date text not null,
      last_checked_at integer not null default 0,
      last_hash text,
      unchanged_streak integer not null default 0,
      interval_ms integer not null default 300000,
      next_due_at integer not null default 0,
      checks integer not null default 0,
      changes integer not null default 0,
      primary key (from_id, to_id, date)
    )`);
    legacy.prepare('insert into probe (from_id, to_id, date, last_hash) values (?, ?, ?, ?)').run(1, 2, '2026-09-20', 'old');
    legacy.close();

    const migrated = openDb(file);
    const info = migrated.prepare('pragma table_info(probe)').all() as unknown as { name: string; pk: number }[];
    expect(info.find((c) => c.name === 'with_transfers')?.pk).toBeGreaterThan(0);
    const row = migrated.prepare('select last_hash as hash from probe where from_id = 1').get() as unknown as { hash: string };
    expect(row.hash).toBe('old');

    upsertProbe(
      migrated,
      { fromId: 1, toId: 2, date: '2026-09-20', kind: 'transfers', withTransfers: true, weight: 1, why: 'x' },
      5_000,
    );
    expect((migrated.prepare('select count(*) as n from probe').get() as unknown as { n: number }).n).toBe(2);
    migrated.close();
    rmSync(file, { force: true });
  });

  it('survives a reopen of the same file', () => {
    const file = `/tmp/uz-watch-test-${process.pid}.sqlite`;
    const first = openDb(file);
    createSqliteCache(first).set('/x', { body: 'v', status: 200, hash: 'h', fetchedAt: 0 }, 600_000);
    first.close();
    const second = openDb(file);
    expect(createSqliteCache(second).get('/x', 1_000)?.body).toBe('v');
    second.close();
  });
});
