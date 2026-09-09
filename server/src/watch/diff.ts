import type { AvailabilitySample } from '../store/history.js';

export type ChangeKind = 'appeared' | 'gone' | 'price_drop' | 'more_seats';

export interface Change {
  kind: ChangeKind;
  tripId: number;
  trainNumber: string;
  classId: string;
  className: string;
  freeSeats: number;
  priceKop: number;
  previousFreeSeats: number;
  previousPriceKop: number | null;
  departAt: number;
}

export interface DiffOptions {
  priceDropMinKop?: number;
  seatJumpMin?: number;
}

export function sampleKey(sample: Pick<AvailabilitySample, 'tripId' | 'classId'>): string {
  return `${sample.tripId}:${sample.classId}`;
}

function isCombination(classId: string): boolean {
  return classId.startsWith('MIX');
}

export function diffSamples(
  previous: Map<string, AvailabilitySample>,
  current: AvailabilitySample[],
  options: DiffOptions = {},
): Change[] {
  const priceDropMinKop = options.priceDropMinKop ?? 1_000;
  const seatJumpMin = options.seatJumpMin ?? 4;
  const changes: Change[] = [];
  const seen = new Set<string>();

  for (const sample of current) {
    const key = sampleKey(sample);
    seen.add(key);
    const before = previous.get(key);

    if (!before || before.freeSeats === 0) {
      if (sample.freeSeats > 0) {
        changes.push(toChange('appeared', sample, before));
      }
      continue;
    }

    if (sample.freeSeats === 0) {
      if (!isCombination(sample.classId)) changes.push(toChange('gone', sample, before));
      continue;
    }

    if (before.priceKop - sample.priceKop >= priceDropMinKop) {
      changes.push(toChange('price_drop', sample, before));
      continue;
    }

    if (sample.freeSeats - before.freeSeats >= seatJumpMin) {
      changes.push(toChange('more_seats', sample, before));
    }
  }

  for (const [key, before] of previous) {
    if (seen.has(key) || before.freeSeats === 0 || isCombination(before.classId)) continue;
    changes.push({
      kind: 'gone',
      tripId: before.tripId,
      trainNumber: before.trainNumber,
      classId: before.classId,
      className: before.className,
      freeSeats: 0,
      priceKop: before.priceKop,
      previousFreeSeats: before.freeSeats,
      previousPriceKop: before.priceKop,
      departAt: before.departAt,
    });
  }

  return changes;
}

function toChange(
  kind: ChangeKind,
  sample: AvailabilitySample,
  before: AvailabilitySample | undefined,
): Change {
  return {
    kind,
    tripId: sample.tripId,
    trainNumber: sample.trainNumber,
    classId: sample.classId,
    className: sample.className,
    freeSeats: sample.freeSeats,
    priceKop: sample.priceKop,
    previousFreeSeats: before?.freeSeats ?? 0,
    previousPriceKop: before?.priceKop ?? null,
    departAt: sample.departAt,
  };
}
