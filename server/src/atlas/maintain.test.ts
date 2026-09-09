import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../store/db.js';
import { UzClient } from '../net/client.js';
import { createMemoryCache } from '../net/cache.js';
import { createMemoryRequestLog } from '../net/log.js';
import type { UzTransport } from '../net/browser.js';
import { createWatch } from '../store/watches.js';
import { trainsForPair } from '../store/atlas.js';
import { maintainAtlas, watchesNeedingAtlas } from './maintain.js';

const searchBody = readFileSync(new URL('../../fixtures/search-kyiv-lviv.json', import.meta.url), 'utf-8');
const detailBody = readFileSync(new URL('../../fixtures/trip-detail.json', import.meta.url), 'utf-8');

function makeDeps(db: Db, clock = 10_000) {
  const transport: UzTransport = {
    async fetchPath(path) {
      if (path.startsWith('/v3/trips?')) return { status: 200, body: searchBody };
      const match = /^\/v3\/trips\/(\d+)$/.exec(path);
      if (match) {
        const detail = JSON.parse(detailBody) as Record<string, unknown>;
        detail.id = Number(match[1]);
        (detail.train as Record<string, unknown>).id = Number(match[1]) % 100_000;
        return { status: 200, body: JSON.stringify(detail) };
      }
      return { status: 404, body: '{}' };
    },
    async reload() {},
    async close() {},
  };
  return {
    db,
    client: new UzClient({ transport, log: createMemoryRequestLog(), cache: createMemoryCache(), now: () => clock }),
    now: () => clock,
    sleep: async () => {},
  };
}

describe('atlas maintenance', () => {
  let db: Db;

  beforeEach(() => {
    db = openDb(':memory:');
  });

  it('flags a watch whose pair is unknown', () => {
    createWatch(db, { fromId: 2200001, toId: 2218000, dateFrom: '2026-09-20' }, 1_000);
    expect(watchesNeedingAtlas(db, 10_000)).toHaveLength(1);
  });

  it('builds the atlas for that pair', async () => {
    createWatch(db, { fromId: 2200001, toId: 2218000, dateFrom: '2026-09-20' }, 1_000);
    const result = await maintainAtlas(makeDeps(db));
    expect(result.pairs).toBe(1);
    expect(trainsForPair(db, 2200001, 2218000).length).toBeGreaterThan(0);
  });

  it('stops asking once the atlas is fresh', async () => {
    createWatch(db, { fromId: 2200001, toId: 2218000, dateFrom: '2026-09-20' }, 1_000);
    await maintainAtlas(makeDeps(db));
    expect(watchesNeedingAtlas(db, 10_000)).toHaveLength(0);
  });

  it('asks again once the atlas goes stale', async () => {
    createWatch(db, { fromId: 2200001, toId: 2218000, dateFrom: '2026-09-20' }, 1_000);
    await maintainAtlas(makeDeps(db));
    expect(watchesNeedingAtlas(db, 10_000 + 7 * 24 * 3_600_000)).toHaveLength(1);
  });

  it('never builds more pairs than allowed in one pass', async () => {
    createWatch(db, { fromId: 2200001, toId: 2218000, dateFrom: '2026-09-20' }, 1_000);
    createWatch(db, { fromId: 2200001, toId: 2210700, dateFrom: '2026-09-20' }, 1_000);
    const result = await maintainAtlas(makeDeps(db), { maxPairs: 1 });
    expect(result.pairs).toBe(1);
  });
});
