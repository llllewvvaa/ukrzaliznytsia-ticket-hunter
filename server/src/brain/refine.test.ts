import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../store/db.js';
import { saveTripRoute } from '../store/atlas.js';
import { refineKind, trainStops } from './refine.js';
import type { TripDetail } from '../uz/types.js';

function route(trainNumber: string, trainId: number, tripId: number, stations: [number, string][]): TripDetail {
  return {
    id: tripId,
    trainId,
    trainNumber,
    stationFromId: stations[0]![0],
    stationToId: stations[stations.length - 1]![0],
    departAt: 0,
    arriveAt: 0,
    routePoints: stations.map(([stationId, stationName], seq) => ({ seq, stationId, stationName, arriveAt: null, departAt: null })),
  };
}

const LVIV = 1;
const TERNOPIL = 2;
const CHERNIVTSI = 3;
const KYIV = 4;
const VADUL = 5;

describe('refineKind', () => {
  let db: Db;

  beforeEach(() => {
    db = openDb(':memory:');
    saveTripRoute(db, route('865Д', 865, 8650, [[LVIV, 'Львів'], [TERNOPIL, 'Тернопіль'], [CHERNIVTSI, 'Чернівці']]), 1_000);
    saveTripRoute(db, route('007К', 7, 70, [[KYIV, 'Київ'], [LVIV, 'Львів'], [CHERNIVTSI, 'Чернівці'], [VADUL, 'Вадул-Сірет']]), 1_000);
  });

  it('reads the stop order of a train', () => {
    expect(trainStops(db, '865Д')).toEqual([LVIV, TERNOPIL, CHERNIVTSI]);
    expect(trainStops(db, 'unknown')).toEqual([]);
  });

  it('keeps "board earlier" when the train really passes the origin afterwards', () => {
    const result = refineKind(db, { kind: 'board_earlier', classId: 'К', trainNumber: '007К', fromId: KYIV, toId: CHERNIVTSI }, LVIV, CHERNIVTSI);
    expect(result.kind).toBe('board_earlier');
    expect(result.why).toBe('квиток від Київ, посадка у Львів');
  });

  it('downgrades "board earlier" for a train that reaches that station after the origin', () => {
    const result = refineKind(db, { kind: 'board_earlier', classId: 'К', trainNumber: '865Д', fromId: TERNOPIL, toId: CHERNIVTSI }, LVIV, CHERNIVTSI);
    expect(result.kind).toBe('neighbor_from');
    expect(result.why).toContain('Тернопіль');
  });

  it('keeps "ride further" only when the train passes the destination first', () => {
    const good = refineKind(db, { kind: 'ride_further', classId: 'К', trainNumber: '007К', fromId: LVIV, toId: VADUL }, LVIV, CHERNIVTSI);
    expect(good).toEqual({ kind: 'ride_further', why: 'квиток до Вадул-Сірет, вихід у Чернівці' });
    const bad = refineKind(db, { kind: 'ride_further', classId: 'К', trainNumber: '865Д', fromId: LVIV, toId: TERNOPIL }, LVIV, CHERNIVTSI);
    expect(bad.kind).toBe('neighbor_to');
  });

  it('falls back to the neighbour label when the route is unknown', () => {
    const result = refineKind(db, { kind: 'board_earlier', classId: 'К', trainNumber: '999Х', fromId: TERNOPIL, toId: CHERNIVTSI }, LVIV, CHERNIVTSI);
    expect(result.kind).toBe('neighbor_from');
  });

  it('calls a direct train direct even when it came from the transfer query', () => {
    expect(refineKind(db, { kind: 'transfers', classId: 'К', trainNumber: '865Д', fromId: LVIV, toId: CHERNIVTSI }, LVIV, CHERNIVTSI).kind).toBe('direct');
    expect(refineKind(db, { kind: 'transfers', classId: 'MIX:1-2', trainNumber: '865Д', fromId: LVIV, toId: CHERNIVTSI }, LVIV, CHERNIVTSI).kind).toBe('transfers');
  });
});
