import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../store/db.js';
import { UzClient } from '../net/client.js';
import { createMemoryCache } from '../net/cache.js';
import { createMemoryRequestLog, type RequestLog } from '../net/log.js';
import type { PageFetchResult, UzTransport } from '../net/browser.js';
import { saveTripRoute } from '../store/atlas.js';
import { createWatch } from '../store/watches.js';
import { knownRoutes, pendingEvents } from '../store/history.js';
import { WatchEngine, type EngineConfig } from './engine.js';
import { diffSamples } from './diff.js';
import { adjacentPairs, isLowerBerth, matchWagons } from './seat-rules.js';
import { parseWagons } from '../uz/parse.js';
import type { TripDetail } from '../uz/types.js';

const wagonsBody = readFileSync(new URL('../../fixtures/wagons-kupe.json', import.meta.url), 'utf-8');

function searchBody(trips: { id: number; number: string; free: number; price: number }[]): string {
  return JSON.stringify({
    station_from: 'A',
    station_to: 'B',
    direct: trips.map((t) => ({
      id: t.id,
      depart_at: 1_700_000_000,
      arrive_at: 1_700_020_000,
      station_from: 'Бета',
      station_to: 'Дельта',
      distance: 500,
      is_departed: false,
      seat_hold_enabled: true,
      monitoring: { allowed: true, auto_purchase: false },
      train: {
        id: t.id % 1000,
        number: t.number,
        wagon_classes: [{ id: 'К', name: 'Купе', free_seats: t.free, price: t.price, amenities: [] }],
      },
    })),
    with_transfer: [],
  });
}

function line(): TripDetail {
  return {
    id: 900,
    trainId: 90,
    trainNumber: '777Т',
    stationFromId: 20,
    stationToId: 40,
    departAt: 1_000,
    arriveAt: 5_000,
    routePoints: [
      { seq: 0, stationId: 10, stationName: 'Альфа', arriveAt: null, departAt: 900 },
      { seq: 1, stationId: 20, stationName: 'Бета', arriveAt: 1_000, departAt: 1_100 },
      { seq: 2, stationId: 30, stationName: 'Гама', arriveAt: 2_000, departAt: 2_100 },
      { seq: 3, stationId: 40, stationName: 'Дельта', arriveAt: 3_000, departAt: 3_100 },
      { seq: 4, stationId: 50, stationName: 'Епсілон', arriveAt: 4_000, departAt: null },
    ],
  };
}

interface Harness {
  db: Db;
  engine: WatchEngine;
  calls: string[];
  log: RequestLog;
  setSearch: (body: string) => void;
  setClock: (value: number) => void;
}

function harness(config: Partial<EngineConfig> = {}): Harness {
  const db = openDb(':memory:');
  saveTripRoute(db, line(), 1_000);
  let clock = 1_000_000;
  let currentSearch = searchBody([{ id: 501, number: '001К', free: 0, price: 50_000 }]);
  const calls: string[] = [];
  const log = createMemoryRequestLog();

  const transport: UzTransport = {
    async fetchPath(path): Promise<PageFetchResult> {
      calls.push(path);
      if (path.startsWith('/v3/trips?')) return { status: 200, body: currentSearch };
      if (path.includes('wagons-by-class')) return { status: 200, body: wagonsBody };
      return { status: 404, body: '{}' };
    },
    async reload() {},
    async close() {},
  };

  const client = new UzClient({
    transport,
    log,
    cache: createMemoryCache(),
    now: () => clock,
    sleep: async () => {},
  });

  const engine = new WatchEngine({
    db,
    client,
    now: () => clock,
    random: () => 0.5,
    config: { dateSlack: 0, maxNeighbors: 0, maxSegmentOptions: 0, ...config },
  });

  return {
    db,
    engine,
    calls,
    log,
    setSearch: (body: string) => {
      currentSearch = body;
    },
    setClock: (value: number) => {
      clock = value;
    },
  };
}

describe('watch engine', () => {
  let h: Harness;

  beforeEach(() => {
    h = harness();
    createWatch(
      h.db,
      { fromId: 20, toId: 40, dateFrom: '2026-09-20', classes: ['К'], seatPrefs: {} },
      1_000,
    );
  });

  it('plans candidates for every active watch', async () => {
    const report = await h.engine.runCycle();
    expect(report.planned).toBeGreaterThan(0);
    expect(report.checked).toBeGreaterThan(0);
  });

  it('stays silent while nothing has free seats', async () => {
    const report = await h.engine.runCycle();
    expect(report.events).toBe(0);
    expect(pendingEvents(h.db)).toHaveLength(0);
  });

  it('treats the first observation as a silent baseline', async () => {
    const fresh = harness();
    createWatch(fresh.db, { fromId: 20, toId: 40, dateFrom: '2026-09-20', classes: ['К'] }, 1_000);
    fresh.setSearch(searchBody([{ id: 501, number: '001К', free: 5, price: 50_000 }]));
    const report = await fresh.engine.runCycle();
    expect(report.baselined).toBeGreaterThan(0);
    expect(report.events).toBe(0);
  });

  it('caps how many seat maps one cycle may pull', async () => {
    const many = harness({ maxSeatChecksPerCycle: 1, maxProbesPerCycle: 10 });
    createWatch(many.db, { fromId: 20, toId: 40, dateFrom: '2026-09-20' }, 1_000);
    await many.engine.runCycle();
    many.setClock(9_000_000);
    many.setSearch(
      searchBody([
        { id: 501, number: '001К', free: 3, price: 50_000 },
        { id: 502, number: '002К', free: 4, price: 51_000 },
        { id: 503, number: '003К', free: 5, price: 52_000 },
      ]),
    );
    const report = await many.engine.runCycle();
    expect(report.seatChecks).toBeLessThanOrEqual(1);
  });

  it('raises an appeared event when a seat shows up', async () => {
    await h.engine.runCycle();
    h.setClock(9_000_000);
    h.setSearch(searchBody([{ id: 501, number: '001К', free: 3, price: 50_000 }]));
    const report = await h.engine.runCycle();
    expect(report.events).toBeGreaterThan(0);
    const events = pendingEvents(h.db);
    expect(events[0]!.kind).toBe('appeared');
    expect(events[0]!.payload.trainNumber).toBe('001К');
  });

  it('attaches concrete seats to the event', async () => {
    await h.engine.runCycle();
    h.setClock(9_000_000);
    h.setSearch(searchBody([{ id: 501, number: '001К', free: 3, price: 50_000 }]));
    await h.engine.runCycle();
    const payload = pendingEvents(h.db)[0]!.payload as { seats: unknown[] };
    expect(Array.isArray(payload.seats)).toBe(true);
    expect(payload.seats.length).toBeGreaterThan(0);
  });

  it('raises a price drop when the fare falls', async () => {
    h.setSearch(searchBody([{ id: 501, number: '001К', free: 3, price: 50_000 }]));
    await h.engine.runCycle();
    h.setClock(9_000_000);
    h.setSearch(searchBody([{ id: 501, number: '001К', free: 3, price: 40_000 }]));
    await h.engine.runCycle();
    expect(pendingEvents(h.db).some((e) => e.kind === 'price_drop')).toBe(true);
  });

  it('respects the price ceiling of the watch', async () => {
    const db = h.db;
    db.prepare('update watch set max_price_kop = 30000').run();
    h.setClock(9_000_000);
    h.setSearch(searchBody([{ id: 501, number: '001К', free: 3, price: 50_000 }]));
    await h.engine.runCycle();
    expect(pendingEvents(db)).toHaveLength(0);
  });

  it('does not re-check a probe before it is due', async () => {
    await h.engine.runCycle();
    const first = h.calls.length;
    await h.engine.runCycle();
    expect(h.calls.length).toBe(first);
  });

  it('is not starved by probes left over from an old date window', async () => {
    const stale = harness({ maxProbesPerCycle: 2, dateSlack: 0, maxNeighbors: 0, maxSegmentOptions: 0 });
    for (let i = 0; i < 10; i += 1) {
      stale.db
        .prepare(
          'insert into probe (from_id, to_id, date, with_transfers, next_due_at, weight, favorite) values (?, ?, ?, 0, 0, 1, 1)',
        )
        .run(20, 40, `2026-08-${String(10 + i).padStart(2, '0')}`);
    }
    createWatch(stale.db, { fromId: 20, toId: 40, dateFrom: '2026-09-20' }, 1_000);
    const report = await stale.engine.runCycle();
    expect(report.checked).toBeGreaterThan(0);
    expect(stale.calls.every((path) => path.includes('2026-09-20'))).toBe(true);
  });

  it('stops calling once the budget is spent', async () => {
    const tight = harness({ perHour: 1, maxProbesPerCycle: 5 });
    createWatch(tight.db, { fromId: 20, toId: 40, dateFrom: '2026-09-20' }, 1_000);
    const report = await tight.engine.runCycle();
    expect(report.checked).toBeLessThanOrEqual(1);
  });

  it('remembers a detour route that produced a hit', async () => {
    const detour = harness({ maxSegmentOptions: 4, maxNeighbors: 0, dateSlack: 0, maxProbesPerCycle: 20 });
    const watch = createWatch(detour.db, { fromId: 20, toId: 40, dateFrom: '2026-09-20' }, 1_000);
    await detour.engine.runCycle();
    detour.setClock(9_000_000);
    detour.setSearch(searchBody([{ id: 777, number: '999Ш', free: 2, price: 30_000 }]));
    await detour.engine.runCycle();
    expect(knownRoutes(detour.db, watch.id).length).toBeGreaterThan(0);
  });
});

describe('transfer combinations', () => {
  const base = { tripId: 1, trainNumber: '001К', className: '2 сегменти', departAt: 100 };

  it('never reports a vanished combination', () => {
    const prev = new Map([['1:MIX:1-2', { ...base, classId: 'MIX:1-2', freeSeats: 2, priceKop: 100 }]]);
    expect(diffSamples(prev, [{ ...base, classId: 'MIX:1-2', freeSeats: 0, priceKop: 100 }])).toEqual([]);
    expect(diffSamples(prev, [])).toEqual([]);
  });

  it('still reports a combination that becomes available', () => {
    const changes = diffSamples(new Map(), [{ ...base, classId: 'MIX:1-2', freeSeats: 2, priceKop: 100 }]);
    expect(changes[0]!.kind).toBe('appeared');
  });
});

describe('diffSamples', () => {
  const base = {
    tripId: 1,
    trainNumber: '001К',
    classId: 'К',
    className: 'Купе',
    departAt: 100,
  };

  it('reports nothing when the picture is identical', () => {
    const prev = new Map([['1:К', { ...base, freeSeats: 2, priceKop: 100 }]]);
    expect(diffSamples(prev, [{ ...base, freeSeats: 2, priceKop: 100 }])).toEqual([]);
  });

  it('reports a disappearance when seats hit zero', () => {
    const prev = new Map([['1:К', { ...base, freeSeats: 2, priceKop: 100 }]]);
    expect(diffSamples(prev, [{ ...base, freeSeats: 0, priceKop: 100 }])[0]!.kind).toBe('gone');
  });

  it('reports a disappearance when the trip vanishes from the answer', () => {
    const prev = new Map([['1:К', { ...base, freeSeats: 2, priceKop: 100 }]]);
    expect(diffSamples(prev, [])[0]!.kind).toBe('gone');
  });

  it('ignores a price drop smaller than the threshold', () => {
    const prev = new Map([['1:К', { ...base, freeSeats: 2, priceKop: 100_000 }]]);
    const changes = diffSamples(prev, [{ ...base, freeSeats: 2, priceKop: 99_500 }], { priceDropMinKop: 1_000 });
    expect(changes).toEqual([]);
  });

  it('reports a bigger seat release', () => {
    const prev = new Map([['1:К', { ...base, freeSeats: 1, priceKop: 100 }]]);
    expect(diffSamples(prev, [{ ...base, freeSeats: 9, priceKop: 100 }])[0]!.kind).toBe('more_seats');
  });
});

describe('seat rules on the real wagon fixture', () => {
  const wagons = parseWagons(JSON.parse(wagonsBody));

  it('treats odd numbers as lower berths', () => {
    expect(isLowerBerth(15)).toBe(true);
    expect(isLowerBerth(16)).toBe(false);
  });

  it('finds adjacent lower-upper pairs', () => {
    expect(adjacentPairs([15, 16, 21, 25])).toEqual([[15, 16]]);
  });

  it('keeps only lower berths when asked', () => {
    const matches = matchWagons(wagons, { berth: 'lower' });
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every((m) => m.seats.every(isLowerBerth))).toBe(true);
  });

  it('drops wagons that cannot seat the whole party', () => {
    expect(matchWagons(wagons, { minSeats: 1_000 })).toEqual([]);
  });

  it('sorts matches by price', () => {
    const matches = matchWagons(wagons, {});
    const prices = matches.map((m) => m.priceKop);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
  });
});
