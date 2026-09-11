import type { Db } from '../store/db.js';

export type Horizon = 'last_day' | 'three_days' | 'week' | 'far';

export interface ForecastInput {
  trainNumber: string;
  classId: string;
  horizon?: Horizon;
  minSamples?: number;
}

export interface ForecastResult {
  trainNumber: string;
  classId: string;
  horizon: Horizon;
  observations: number;
  emptyObservations: number;
  appearances: number;
  probability: number | null;
  medianPriceKop: number | null;
  note: string;
}

interface SnapshotRow {
  takenAt: number;
  freeSeats: number;
  priceKop: number;
  departAt: number;
}

export function horizonOf(hoursToDeparture: number): Horizon {
  if (hoursToDeparture <= 24) return 'last_day';
  if (hoursToDeparture <= 72) return 'three_days';
  if (hoursToDeparture <= 168) return 'week';
  return 'far';
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : Math.round((sorted[middle - 1]! + sorted[middle]!) / 2);
}

export function forecast(db: Db, input: ForecastInput): ForecastResult {
  const minSamples = input.minSamples ?? 20;
  const rows = db
    .prepare(
      `select taken_at as takenAt, free_seats as freeSeats, price_kop as priceKop, depart_at as departAt
       from snapshot where train_number = ? and class_id = ? and depart_at > 0
       order by trip_id, taken_at`,
    )
    .all(input.trainNumber, input.classId) as unknown as SnapshotRow[];

  const wanted = input.horizon;
  let observations = 0;
  let emptyObservations = 0;
  let appearances = 0;
  const prices: number[] = [];
  let previousEmpty = false;

  for (const row of rows) {
    const hours = (row.departAt * 1_000 - row.takenAt) / 3_600_000;
    if (hours < 0) continue;
    const bucket = horizonOf(hours);
    if (wanted && bucket !== wanted) {
      previousEmpty = row.freeSeats === 0;
      continue;
    }
    observations += 1;
    if (row.freeSeats > 0) {
      prices.push(row.priceKop);
      if (previousEmpty) appearances += 1;
    } else {
      emptyObservations += 1;
    }
    previousEmpty = row.freeSeats === 0;
  }

  const enough = emptyObservations >= minSamples;
  return {
    trainNumber: input.trainNumber,
    classId: input.classId,
    horizon: wanted ?? 'far',
    observations,
    emptyObservations,
    appearances,
    probability: enough ? appearances / emptyObservations : null,
    medianPriceKop: median(prices),
    note: enough
      ? 'частота появи місць порахована з нашої історії'
      : `недостатньо даних: потрібно щонайменше ${minSamples} спостережень з нульовою наявністю, є ${emptyObservations}`,
  };
}

export function watchedTrains(
  db: Db,
  limit = 20,
): { trainNumber: string; classId: string; rows: number }[] {
  return db
    .prepare(
      `select train_number as trainNumber, class_id as classId, count(*) as rows
       from snapshot where class_id not like 'MIX%'
       group by train_number, class_id order by rows desc limit ?`,
    )
    .all(limit) as unknown as { trainNumber: string; classId: string; rows: number }[];
}
