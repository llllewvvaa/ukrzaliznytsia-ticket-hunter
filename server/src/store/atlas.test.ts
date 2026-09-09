import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './db.js';
import { parseTripDetail } from '../uz/parse.js';
import {
  atlasStats,
  buildPairIndex,
  neighborStations,
  routeOf,
  saveTripRoute,
  segmentOptions,
  trainsForPair,
} from './atlas.js';
import type { TripDetail } from '../uz/types.js';

function realDetail(): TripDetail {
  const raw = JSON.parse(
    readFileSync(new URL('../../fixtures/trip-detail.json', import.meta.url), 'utf-8'),
  );
  return parseTripDetail(raw);
}

function syntheticDetail(): TripDetail {
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

describe('route atlas', () => {
  let db: Db;

  beforeEach(() => {
    db = openDb(':memory:');
  });

  it('stores every stop of a real trip', () => {
    const saved = saveTripRoute(db, realDetail(), 1_000);
    expect(saved).toBe(11);
    expect(routeOf(db, realDetail().id)).toHaveLength(11);
    expect(atlasStats(db).stations).toBe(11);
  });

  it('builds the pair index locally with no network', () => {
    saveTripRoute(db, syntheticDetail(), 1_000);
    const pairs = buildPairIndex(db, 1_000);
    expect(pairs).toBe(10);
    expect(trainsForPair(db, 20, 40)).toEqual([90]);
    expect(trainsForPair(db, 40, 20)).toEqual([]);
  });

  it('lists adjacent stations of a stop', () => {
    saveTripRoute(db, syntheticDetail(), 1_000);
    const names = neighborStations(db, 30, 1)
      .map((s) => s.name)
      .sort();
    expect(names).toEqual(['Бета', 'Дельта']);
  });

  it('widens the neighbourhood with more hops', () => {
    saveTripRoute(db, syntheticDetail(), 1_000);
    expect(neighborStations(db, 30, 2)).toHaveLength(4);
  });

  it('offers riding further and boarding earlier for the same train', () => {
    saveTripRoute(db, syntheticDetail(), 1_000);
    const options = segmentOptions(db, 20, 40);
    expect(options.find((o) => o.kind === 'direct')).toBeTruthy();
    const further = options.find((o) => o.kind === 'ride_further');
    expect(further?.toName).toBe('Епсілон');
    const earlier = options.find((o) => o.kind === 'board_earlier');
    expect(earlier?.fromName).toBe('Альфа');
  });

  it('never suggests travelling against the train direction', () => {
    saveTripRoute(db, syntheticDetail(), 1_000);
    expect(segmentOptions(db, 40, 20)).toEqual([]);
  });

  it('keeps the real trip queryable by its endpoints', () => {
    const detail = realDetail();
    saveTripRoute(db, detail, 1_000);
    buildPairIndex(db, 1_000);
    expect(trainsForPair(db, detail.stationFromId, detail.stationToId)).toContain(detail.trainId);
  });
});
