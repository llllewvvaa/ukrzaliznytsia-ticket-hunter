import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../store/db.js';
import { recordSnapshots } from '../store/history.js';
import { forecast, horizonOf, median, watchedTrains } from './forecast.js';

const DEPART = Math.floor(Date.UTC(2026, 8, 20, 12, 0) / 1_000);

function snap(db: Db, takenAt: number, freeSeats: number, priceKop = 50_000, tripId = 1): void {
  recordSnapshots(db, takenAt, { fromId: 1, toId: 2, date: '2026-09-20', source: 'direct' }, [
    {
      tripId,
      trainNumber: '017О',
      classId: 'К',
      className: 'Купе',
      freeSeats,
      priceKop,
      departAt: DEPART,
    },
  ]);
}

describe('forecast helpers', () => {
  it('buckets by hours to departure', () => {
    expect(horizonOf(3)).toBe('last_day');
    expect(horizonOf(48)).toBe('three_days');
    expect(horizonOf(100)).toBe('week');
    expect(horizonOf(400)).toBe('far');
  });

  it('computes a median', () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(3);
  });
});

describe('forecast', () => {
  let db: Db;

  beforeEach(() => {
    db = openDb(':memory:');
  });

  it('refuses to guess without enough history', () => {
    snap(db, (DEPART - 3_600) * 1_000, 0);
    const result = forecast(db, { trainNumber: '017О', classId: 'К', horizon: 'last_day' });
    expect(result.probability).toBeNull();
    expect(result.note).toContain('недостатньо даних');
  });

  it('counts how often seats appeared after an empty reading', () => {
    let t = (DEPART - 20 * 3_600) * 1_000;
    for (let i = 0; i < 10; i += 1) {
      snap(db, t, 0);
      t += 1_800_000;
      snap(db, t, 2);
      t += 1_800_000;
    }
    const result = forecast(db, {
      trainNumber: '017О',
      classId: 'К',
      horizon: 'last_day',
      minSamples: 5,
    });
    expect(result.emptyObservations).toBe(10);
    expect(result.appearances).toBe(10);
    expect(result.probability).toBe(1);
  });

  it('reports a zero rate when seats never came back', () => {
    let t = (DEPART - 20 * 3_600) * 1_000;
    for (let i = 0; i < 8; i += 1) {
      snap(db, t, 0);
      t += 1_800_000;
    }
    const result = forecast(db, {
      trainNumber: '017О',
      classId: 'К',
      horizon: 'last_day',
      minSamples: 5,
    });
    expect(result.probability).toBe(0);
  });

  it('keeps horizons apart', () => {
    snap(db, (DEPART - 200 * 3_600) * 1_000, 0);
    snap(db, (DEPART - 2 * 3_600) * 1_000, 0);
    const far = forecast(db, { trainNumber: '017О', classId: 'К', horizon: 'far', minSamples: 1 });
    const near = forecast(db, {
      trainNumber: '017О',
      classId: 'К',
      horizon: 'last_day',
      minSamples: 1,
    });
    expect(far.emptyObservations).toBe(1);
    expect(near.emptyObservations).toBe(1);
  });

  it('reports the median observed price', () => {
    snap(db, (DEPART - 10 * 3_600) * 1_000, 2, 40_000);
    snap(db, (DEPART - 9 * 3_600) * 1_000, 2, 60_000);
    const result = forecast(db, {
      trainNumber: '017О',
      classId: 'К',
      horizon: 'last_day',
      minSamples: 1,
    });
    expect(result.medianPriceKop).toBe(50_000);
  });

  it('lists which trains history is piling up for', () => {
    snap(db, (DEPART - 10 * 3_600) * 1_000, 1);
    snap(db, (DEPART - 9 * 3_600) * 1_000, 1);
    expect(watchedTrains(db)[0]).toMatchObject({ trainNumber: '017О', classId: 'К', rows: 2 });
  });
});
