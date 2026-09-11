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
const KOLOMYIA = 6;
const PIDZAMCHE = 7;
const KYIV_PAS = 8;

describe('refineKind', () => {
  let db: Db;

  beforeEach(() => {
    db = openDb(':memory:');
    saveTripRoute(db, route('865Д', 865, 8650, [[LVIV, 'Львів'], [TERNOPIL, 'Тернопіль'], [CHERNIVTSI, 'Чернівці']]), 1_000);
    saveTripRoute(
      db,
      route('007К', 7, 70, [[KYIV, 'Київ'], [LVIV, 'Львів'], [KOLOMYIA, 'Коломия'], [CHERNIVTSI, 'Чернівці'], [VADUL, 'Вадул-Сірет']]),
      1_000,
    );
  });

  function timed(): void {
    saveTripRoute(
      db,
      {
        id: 7400,
        trainId: 74,
        trainNumber: '743К',
        stationFromId: KYIV_PAS,
        stationToId: LVIV,
        departAt: 0,
        arriveAt: 0,
        routePoints: [
          { seq: 0, stationId: KYIV_PAS, stationName: 'Київ-Пас', arriveAt: null, departAt: 10_000 },
          { seq: 1, stationId: TERNOPIL, stationName: 'Тернопіль', arriveAt: 25_000, departAt: 25_300 },
          { seq: 2, stationId: PIDZAMCHE, stationName: 'Львів-Підзамче', arriveAt: 30_000, departAt: 30_120 },
          { seq: 3, stationId: LVIV, stationName: 'Львів', arriveAt: 30_720, departAt: null },
        ],
      },
      1_000,
    );
  }

  it('offers getting off at a stop the train leaves minutes before the destination', () => {
    timed();
    const result = refineKind(db, { kind: 'alight_earlier', classId: 'С2', trainNumber: '743К', fromId: KYIV_PAS, toId: PIDZAMCHE }, KYIV_PAS, LVIV);
    expect(result).toMatchObject({ kind: 'alight_earlier', boardId: KYIV_PAS, alightId: PIDZAMCHE });
    expect(result!.why).toBe('квиток до Львів-Підзамче, це за 12 хв до Львів');
  });

  it('refuses when the stop is farther from the destination than the limit', () => {
    timed();
    const offer = { kind: 'alight_earlier', classId: 'С2', trainNumber: '743К', fromId: KYIV_PAS, toId: TERNOPIL };
    expect(refineKind(db, offer, KYIV_PAS, LVIV)).toBeNull();
    expect(refineKind(db, offer, KYIV_PAS, LVIV, { alightEarlierMin: 120 })?.kind).toBe('alight_earlier');
  });

  it('refuses when the owner switched it off', () => {
    timed();
    const offer = { kind: 'alight_earlier', classId: 'С2', trainNumber: '743К', fromId: KYIV_PAS, toId: PIDZAMCHE };
    expect(refineKind(db, offer, KYIV_PAS, LVIV, { alightEarlierMin: 0 })).toBeNull();
  });

  it('refuses a stop the train reaches after the destination', () => {
    timed();
    expect(refineKind(db, { kind: 'alight_earlier', classId: 'К', trainNumber: '007К', fromId: LVIV, toId: VADUL }, LVIV, CHERNIVTSI)).toBeNull();
  });

  it('reads the stop order of a train', () => {
    expect(trainStops(db, '865Д')).toEqual([LVIV, TERNOPIL, CHERNIVTSI]);
    expect(trainStops(db, 'unknown')).toEqual([]);
  });

  it('keeps a ticket bought from a station before the origin', () => {
    const result = refineKind(db, { kind: 'board_earlier', classId: 'К', trainNumber: '007К', fromId: KYIV, toId: CHERNIVTSI }, LVIV, CHERNIVTSI);
    expect(result).toMatchObject({ kind: 'board_earlier', why: 'квиток від Київ, посадка у Львів', boardId: LVIV, alightId: CHERNIVTSI });
  });

  it('keeps a ticket to a station after the destination', () => {
    const result = refineKind(db, { kind: 'ride_further', classId: 'К', trainNumber: '007К', fromId: LVIV, toId: VADUL }, LVIV, CHERNIVTSI);
    expect(result).toMatchObject({ kind: 'ride_further', why: 'квиток до Вадул-Сірет, вихід у Чернівці' });
  });

  it('drops a ticket from a station the train reaches after the origin', () => {
    expect(refineKind(db, { kind: 'board_earlier', classId: 'К', trainNumber: '865Д', fromId: TERNOPIL, toId: CHERNIVTSI }, LVIV, CHERNIVTSI)).toBeNull();
  });

  it('drops a ticket that ends before the destination', () => {
    expect(refineKind(db, { kind: 'ride_further', classId: 'К', trainNumber: '007К', fromId: LVIV, toId: KOLOMYIA }, LVIV, CHERNIVTSI)).toBeNull();
  });

  it('drops the old neighbour-station kinds outright', () => {
    expect(refineKind(db, { kind: 'neighbor_to', classId: 'К', trainNumber: '007К', fromId: LVIV, toId: KOLOMYIA }, LVIV, CHERNIVTSI)).toBeNull();
    expect(refineKind(db, { kind: 'neighbor_from', classId: 'К', trainNumber: '865Д', fromId: TERNOPIL, toId: CHERNIVTSI }, LVIV, CHERNIVTSI)).toBeNull();
  });

  it('drops a detour when the route is unknown', () => {
    expect(refineKind(db, { kind: 'board_earlier', classId: 'К', trainNumber: '999Х', fromId: KYIV, toId: CHERNIVTSI }, LVIV, CHERNIVTSI)).toBeNull();
  });

  it('calls a direct train direct even when it came from the transfer query', () => {
    expect(refineKind(db, { kind: 'transfers', classId: 'К', trainNumber: '865Д', fromId: LVIV, toId: CHERNIVTSI }, LVIV, CHERNIVTSI)?.kind).toBe('direct');
    expect(refineKind(db, { kind: 'transfers', classId: 'MIX:1-2', trainNumber: 'x', fromId: LVIV, toId: CHERNIVTSI }, LVIV, CHERNIVTSI)?.kind).toBe('transfers');
  });
});
