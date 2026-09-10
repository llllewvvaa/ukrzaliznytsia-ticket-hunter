import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from './db.js';
import { saveTripRoute } from './atlas.js';
import { createWatch } from './watches.js';
import { recordSnapshots } from './history.js';
import { markViewed, watchOptions } from './options.js';
import type { TripDetail } from '../uz/types.js';

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
      { seq: 2, stationId: 40, stationName: 'Дельта', arriveAt: 3_000, departAt: 3_100 },
      { seq: 3, stationId: 50, stationName: 'Епсілон', arriveAt: 4_000, departAt: null },
    ],
  };
}

const NOW = 10_000_000;

function snap(db: Db, over: Partial<{ fromId: number; toId: number; date: string; train: string; classId: string; seats: number; price: number; why: string; kind: string; at: number }> = {}) {
  const o = { fromId: 20, toId: 40, date: '2026-09-25', train: '001К', classId: 'К', seats: 2, price: 50_000, why: 'прямий напрямок', kind: 'direct', at: NOW - 60_000, ...over };
  recordSnapshots(db, o.at, { fromId: o.fromId, toId: o.toId, date: o.date, source: o.kind, why: o.why }, [
    { tripId: 1, trainNumber: o.train, classId: o.classId, className: o.classId, freeSeats: o.seats, priceKop: o.price, departAt: 1_790_000_000 },
  ]);
}

describe('watch options', () => {
  let db: Db;

  beforeEach(() => {
    db = openDb(':memory:');
    saveTripRoute(db, line(), 1_000);
  });

  it('lists what the watcher last saw with seats, cheapest first per date', () => {
    const watch = createWatch(db, { fromId: 20, toId: 40, dateFrom: '2026-09-25' }, 1_000);
    snap(db, { train: '002К', price: 60_000 });
    snap(db, { train: '001К', price: 40_000 });
    const result = watchOptions(db, watch, NOW);
    expect(result.options.map((o) => o.trainNumber)).toEqual(['001К', '002К']);
    expect(result.options[0]!.fromName).toBe('Бета');
  });

  it('keeps the explanation of a detour', () => {
    const watch = createWatch(db, { fromId: 20, toId: 40, dateFrom: '2026-09-25' }, 1_000);
    snap(db, { toId: 50, why: 'їхати далі до Епсілон потягом 777Т', kind: 'ride_further' });
    const option = watchOptions(db, watch, NOW).options[0]!;
    expect(option.why).toContain('Епсілон');
    expect(option.toName).toBe('Епсілон');
  });

  it('drops trains without seats in the latest reading', () => {
    const watch = createWatch(db, { fromId: 20, toId: 40, dateFrom: '2026-09-25' }, 1_000);
    snap(db, { seats: 3, at: NOW - 120_000 });
    snap(db, { seats: 0, at: NOW - 60_000 });
    expect(watchOptions(db, watch, NOW).options).toHaveLength(0);
  });

  it('honours the classes and the price ceiling of the watch', () => {
    const watch = createWatch(db, { fromId: 20, toId: 40, dateFrom: '2026-09-25', classes: ['П'], maxPriceKop: 45_000 }, 1_000);
    snap(db, { classId: 'К', price: 30_000 });
    snap(db, { classId: 'П', price: 50_000, train: '003К' });
    snap(db, { classId: 'П', price: 40_000, train: '004К' });
    expect(watchOptions(db, watch, NOW).options.map((o) => o.trainNumber)).toEqual(['004К']);
  });

  it('ignores pairs and dates outside the plan', () => {
    const watch = createWatch(db, { fromId: 20, toId: 40, dateFrom: '2026-09-25' }, 1_000);
    snap(db, { date: '2026-10-30' });
    expect(watchOptions(db, watch, NOW).options).toHaveLength(0);
  });

  it('flags trains announced since the last visit as new', () => {
    const watch = createWatch(db, { fromId: 20, toId: 40, dateFrom: '2026-09-25' }, 1_000);
    snap(db);
    db.prepare('insert into announced (watch_id, date, train_number, announced_at) values (?, ?, ?, ?)').run(
      watch.id,
      '2026-09-25',
      '001К',
      NOW - 30_000,
    );
    expect(watchOptions(db, watch, NOW).options[0]!.isNew).toBe(true);
    markViewed(db, watch.id, NOW);
    expect(watchOptions(db, watch, NOW + 1).options[0]!.isNew).toBe(false);
  });
});
