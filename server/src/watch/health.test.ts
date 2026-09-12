import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../store/db.js';
import { createSqliteRequestLog } from '../store/log-sqlite.js';
import { errorRatio, readHealth, throttleFactor } from './health.js';

describe('health', () => {
  let db: Db;

  beforeEach(() => {
    db = openDb(':memory:');
  });

  const log = (status: number, count: number, cacheHit = false): void => {
    const sink = createSqliteRequestLog(db);
    for (let i = 0; i < count; i += 1) {
      sink.record({ ts: 1_000 + i, path: '/v3/trips', status, ms: 10, cacheHit, bytes: 100 });
    }
  };

  it('counts failures by kind', () => {
    log(200, 8);
    log(503, 3);
    log(441, 1);
    log(429, 1);
    expect(readHealth(db, 0)).toEqual({ total: 13, serverErrors: 3, gated: 1, rateLimited: 1 });
  });

  it('ignores cache hits', () => {
    log(200, 5, true);
    expect(readHealth(db, 0).total).toBe(0);
  });

  it('keeps full speed while the API is healthy', () => {
    log(200, 20);
    expect(throttleFactor(readHealth(db, 0))).toBe(1);
  });

  it('halves the pace when a fifth of calls fail', () => {
    log(200, 15);
    log(503, 5);
    expect(errorRatio(readHealth(db, 0))).toBeCloseTo(0.25);
    expect(throttleFactor(readHealth(db, 0))).toBe(0.5);
  });

  it('quarters the pace when failures dominate', () => {
    log(200, 10);
    log(503, 10);
    expect(throttleFactor(readHealth(db, 0))).toBe(0.25);
  });

  it('refuses to judge on too few samples', () => {
    log(503, 3);
    expect(throttleFactor(readHealth(db, 0))).toBe(1);
  });
});
