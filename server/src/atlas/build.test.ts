import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../store/db.js';
import { UzClient } from '../net/client.js';
import { createMemoryCache } from '../net/cache.js';
import { createMemoryRequestLog } from '../net/log.js';
import type { PageFetchResult, UzTransport } from '../net/browser.js';
import { buildAtlas, trainNeedsRoute, ROUTE_TTL_MS } from './build.js';
import { atlasStats, trainsForPair } from '../store/atlas.js';

const searchBody = readFileSync(new URL('../../fixtures/search-kyiv-lviv.json', import.meta.url), 'utf-8');
const detailBody = readFileSync(new URL('../../fixtures/trip-detail.json', import.meta.url), 'utf-8');

function transportFor(calls: string[]): UzTransport {
  return {
    async fetchPath(path): Promise<PageFetchResult> {
      calls.push(path);
      if (path.startsWith('/v3/trips?')) return { status: 200, body: searchBody };
      const detailMatch = /^\/v3\/trips\/(\d+)$/.exec(path);
      if (detailMatch) {
        const tripId = Number(detailMatch[1]);
        const detail = JSON.parse(detailBody) as Record<string, unknown>;
        detail.id = tripId;
        (detail.train as Record<string, unknown>).id = tripId % 100_000;
        return { status: 200, body: JSON.stringify(detail) };
      }
      return { status: 404, body: '{}' };
    },
    async reload() {},
    async close() {},
  };
}

function makeDeps(db: Db, calls: string[]) {
  const client = new UzClient({
    transport: transportFor(calls),
    log: createMemoryRequestLog(),
    cache: createMemoryCache(),
    now: () => 10_000,
  });
  return { db, client, now: () => 10_000, sleep: async () => {}, pacingMs: 0 };
}

describe('atlas build', () => {
  let db: Db;
  let calls: string[];

  beforeEach(() => {
    db = openDb(':memory:');
    calls = [];
  });

  it('searches each date once and stores routes for unseen trains', async () => {
    const result = await buildAtlas(makeDeps(db, calls), {
      fromId: 2200001,
      toId: 2218000,
      dates: ['2026-09-15', '2026-09-16'],
    });
    expect(result.searched).toBe(2);
    expect(result.tripsSeen).toBe(62);
    expect(result.routesFetched).toBeGreaterThan(0);
    expect(atlasStats(db).trips).toBe(result.routesFetched);
  });

  it('builds the pair index so lookups need no network afterwards', async () => {
    await buildAtlas(makeDeps(db, calls), { fromId: 2200001, toId: 2218000, dates: ['2026-09-15'] });
    const before = calls.length;
    expect(trainsForPair(db, 2200001, 2218000).length).toBeGreaterThan(0);
    expect(calls.length).toBe(before);
  });

  it('does not refetch a route it already has', async () => {
    await buildAtlas(makeDeps(db, calls), { fromId: 2200001, toId: 2218000, dates: ['2026-09-15'] });
    const firstDetailCalls = calls.filter((p) => /^\/v3\/trips\/\d+$/.test(p)).length;
    calls.length = 0;
    await buildAtlas(makeDeps(db, calls), { fromId: 2200001, toId: 2218000, dates: ['2026-09-15'] });
    const secondDetailCalls = calls.filter((p) => /^\/v3\/trips\/\d+$/.test(p)).length;
    expect(firstDetailCalls).toBeGreaterThan(0);
    expect(secondDetailCalls).toBe(0);
  });

  it('refetches a route once it goes stale', async () => {
    await buildAtlas(makeDeps(db, calls), { fromId: 2200001, toId: 2218000, dates: ['2026-09-15'] });
    const trainId = (db.prepare('select id from train limit 1').get() as unknown as { id: number }).id;
    expect(trainNeedsRoute(db, trainId, 10_000)).toBe(false);
    expect(trainNeedsRoute(db, trainId, 10_000 + ROUTE_TTL_MS + 1)).toBe(true);
  });
});
