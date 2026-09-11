import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './db.js';
import { saveTripRoute } from './atlas.js';
import { createWatch } from './watches.js';
import { recordSnapshots } from './history.js';
import { markViewed, watchOptions } from './options.js';
import type { TripDetail } from '../uz/types.js';

const KYIV = 10;
const LVIV = 20;
const KOLOMYIA = 30;
const CHERNIVTSI = 40;
const VADUL = 50;

function line(): TripDetail {
  return {
    id: 900,
    trainId: 90,
    trainNumber: '007К',
    stationFromId: KYIV,
    stationToId: VADUL,
    departAt: 0,
    arriveAt: 0,
    routePoints: [
      { seq: 0, stationId: KYIV, stationName: 'Київ', arriveAt: null, departAt: 100_000 },
      { seq: 1, stationId: LVIV, stationName: 'Львів', arriveAt: 100_000 + 25_000, departAt: 100_000 + 25_200 },
      { seq: 2, stationId: KOLOMYIA, stationName: 'Коломия', arriveAt: 100_000 + 36_000, departAt: 100_000 + 36_300 },
      { seq: 3, stationId: CHERNIVTSI, stationName: 'Чернівці', arriveAt: 100_000 + 43_200, departAt: 100_000 + 43_500 },
      { seq: 4, stationId: VADUL, stationName: 'Вадул-Сірет', arriveAt: 100_000 + 46_800, departAt: null },
    ],
  };
}

const NOW = 10_000_000;
const TICKET_DEPART = 1_790_000_000;

interface SnapInput {
  fromId: number;
  toId: number;
  train: string;
  classId: string;
  seats: number;
  price: number;
  kind: string;
  departAt: number;
  arriveAt: number;
  at: number;
  segments?: { trainNumber: string; from: string; to: string; departAt: number; arriveAt: number }[];
}

function snap(db: Db, over: Partial<SnapInput> = {}) {
  const o: SnapInput = {
    fromId: LVIV,
    toId: CHERNIVTSI,
    train: '007К',
    classId: 'К',
    seats: 2,
    price: 50_000,
    kind: 'direct',
    departAt: TICKET_DEPART,
    arriveAt: TICKET_DEPART + 18_000,
    at: NOW - 60_000,
    ...over,
  };
  recordSnapshots(db, o.at, { fromId: o.fromId, toId: o.toId, date: '2026-09-25', source: o.kind }, [
    {
      tripId: 1,
      trainNumber: o.train,
      classId: o.classId,
      className: o.classId,
      freeSeats: o.seats,
      priceKop: o.price,
      departAt: o.departAt,
      arriveAt: o.arriveAt,
      ...(o.segments ? { segments: o.segments } : {}),
    },
  ]);
}

describe('watch options', () => {
  let db: Db;

  beforeEach(() => {
    db = openDb(':memory:');
    saveTripRoute(db, line(), 1_000);
  });

  const watch = (over: Record<string, unknown> = {}) =>
    createWatch(db, { fromId: LVIV, toId: CHERNIVTSI, dateFrom: '2026-09-25', ...over }, 1_000);

  it('gives departure, arrival and the time on the way', () => {
    const w = watch();
    snap(db);
    const option = watchOptions(db, w, NOW).options[0]!;
    expect(option.journeyDepartAt).toBe(TICKET_DEPART);
    expect(option.journeyArriveAt).toBe(TICKET_DEPART + 18_000);
    expect(option.durationMin).toBe(300);
  });

  it('shows a ticket from an earlier station with the time the train is in Lviv', () => {
    const w = watch();
    snap(db, { fromId: KYIV, kind: 'board_earlier', seats: 1, departAt: TICKET_DEPART, arriveAt: TICKET_DEPART + 43_200, price: 90_000 });
    const option = watchOptions(db, w, NOW).options[0]!;
    expect(option.why).toBe('квиток від Київ, посадка у Львів');
    expect(option.boardName).toBe('Львів');
    expect(option.journeyDepartAt).toBe(TICKET_DEPART + 25_200);
    expect(option.journeyArriveAt).toBe(TICKET_DEPART + 43_200);
  });

  it('hides the detour when the same train has an ordinary ticket that day', () => {
    const w = watch();
    snap(db);
    snap(db, { fromId: KYIV, kind: 'board_earlier', price: 30_000 });
    const options = watchOptions(db, w, NOW).options;
    expect(options).toHaveLength(1);
    expect(options[0]!.kind).toBe('direct');
  });

  it('never offers a ticket that stops short of the destination', () => {
    const w = watch();
    snap(db, { toId: KOLOMYIA, kind: 'neighbor_to' });
    snap(db, { toId: KOLOMYIA, kind: 'ride_further' });
    expect(watchOptions(db, w, NOW).options).toHaveLength(0);
  });

  it('offers getting off at Коломия when the train has no ticket to Чернівці and is close', () => {
    const w = watch({ alightEarlierMin: 120 });
    snap(db, { toId: KOLOMYIA, kind: 'alight_earlier', departAt: TICKET_DEPART, arriveAt: TICKET_DEPART + 10_800 });
    const option = watchOptions(db, w, NOW).options[0]!;
    expect(option.kind).toBe('alight_earlier');
    expect(option.alightName).toBe('Коломия');
    expect(option.why).toBe('квиток до Коломия, це за 120 хв до Чернівці');
    expect(option.journeyArriveAt).toBe(TICKET_DEPART + 10_800);
  });

  it('hides getting off early when the train has an ordinary ticket that day', () => {
    const w = watch({ alightEarlierMin: 120 });
    snap(db);
    snap(db, { toId: KOLOMYIA, kind: 'alight_earlier', price: 10_000 });
    expect(watchOptions(db, w, NOW).options.map((o) => o.kind)).toEqual(['direct']);
  });

  it('respects the owner limit for getting off early', () => {
    const w = watch({ alightEarlierMin: 30 });
    snap(db, { toId: KOLOMYIA, kind: 'alight_earlier' });
    expect(watchOptions(db, w, NOW).options).toHaveLength(0);
  });

  it('keeps the legs of a transfer', () => {
    const w = watch();
    snap(db, {
      train: '111К + 222П',
      classId: 'MIX:1-2',
      kind: 'transfers',
      segments: [
        { trainNumber: '111К', from: 'Львів', to: 'Тернопіль', departAt: 1_000, arriveAt: 5_000 },
        { trainNumber: '222П', from: 'Тернопіль', to: 'Чернівці', departAt: 8_000, arriveAt: 12_000 },
      ],
    });
    const option = watchOptions(db, w, NOW).options[0]!;
    expect(option.segments).toHaveLength(2);
    expect(option.journeyDepartAt).toBe(1_000);
    expect(option.journeyArriveAt).toBe(12_000);
  });

  it('drops trains without seats in the latest reading', () => {
    const w = watch();
    snap(db, { seats: 3, at: NOW - 120_000 });
    snap(db, { seats: 0, at: NOW - 60_000 });
    expect(watchOptions(db, w, NOW).options).toHaveLength(0);
  });

  it('flags trains announced since the last visit as new', () => {
    const w = watch();
    snap(db);
    db.prepare('insert into announced (watch_id, date, train_number, announced_at) values (?, ?, ?, ?)').run(
      w.id,
      '2026-09-25',
      '007К',
      NOW - 30_000,
    );
    expect(watchOptions(db, w, NOW).options[0]!.isNew).toBe(true);
    markViewed(db, w.id, NOW);
    expect(watchOptions(db, w, NOW + 1).options[0]!.isNew).toBe(false);
  });
});
