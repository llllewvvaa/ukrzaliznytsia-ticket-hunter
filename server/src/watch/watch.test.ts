import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../store/db.js';
import { createBudget, msUntilToken, refill, take } from './budget.js';
import {
  BASE_INTERVAL_MS,
  MAX_INTERVAL_MS,
  MIN_INTERVAL_MS,
  NIGHT_FACTOR,
  applyNight,
  departureBoost,
  isNight,
  nextInterval,
  withJitter,
} from './interval.js';
import { dueProbes, getProbe, recordProbe, scoreProbe, upsertProbe } from './probe-store.js';
import type { Candidate } from '../brain/candidates.js';

const candidate = (over: Partial<Candidate> = {}): Candidate => ({
  fromId: 1,
  toId: 2,
  date: '2026-09-20',
  kind: 'direct',
  withTransfers: false,
  weight: 1,
  why: 'test',
  ...over,
});

describe('budget', () => {
  it('starts with a burst and spends it', () => {
    const state = createBudget(300, 0, 25);
    const { state: after, granted } = take(state, 0, 10);
    expect(granted).toBe(10);
    expect(after.tokens).toBe(15);
  });

  it('refills at the configured hourly rate', () => {
    const state = { ...createBudget(300, 0, 25), tokens: 0 };
    expect(Math.round(refill(state, 3_600_000).tokens)).toBe(25);
  });

  it('refuses to grant beyond what is available', () => {
    const state = { ...createBudget(300, 0, 25), tokens: 2 };
    expect(take(state, 0, 10).granted).toBe(2);
  });

  it('never grants from a negative balance', () => {
    const state = { ...createBudget(300, 0, 25), tokens: -3 };
    const result = take(state, 0, 1);
    expect(result.granted).toBe(0);
    expect(result.state.tokens).toBe(-3);
  });

  it('reports how long until the next token', () => {
    const state = { ...createBudget(360, 0, 30), tokens: 0 };
    expect(msUntilToken(state, 0)).toBe(10_000);
  });
});

describe('interval policy', () => {
  it('grows while nothing changes and stops at the ceiling', () => {
    let interval = MIN_INTERVAL_MS;
    for (let i = 0; i < 20; i += 1) interval = nextInterval(interval, false);
    expect(interval).toBe(MAX_INTERVAL_MS);
  });

  it('grows at least fourfold after five unchanged answers', () => {
    let interval = MIN_INTERVAL_MS;
    for (let i = 0; i < 5; i += 1) interval = nextInterval(interval, false);
    expect(interval / MIN_INTERVAL_MS).toBeGreaterThanOrEqual(4);
  });

  it('drops back to the floor the moment something changes', () => {
    expect(nextInterval(MAX_INTERVAL_MS, true)).toBe(MIN_INTERVAL_MS);
  });

  it('slows down at night', () => {
    const nightUtc = Date.UTC(2026, 8, 20, 23, 0);
    expect(isNight(nightUtc)).toBe(true);
    expect(applyNight(BASE_INTERVAL_MS, nightUtc)).toBe(BASE_INTERVAL_MS * NIGHT_FACTOR);
  });

  it('keeps daytime intervals untouched', () => {
    const dayUtc = Date.UTC(2026, 8, 20, 9, 0);
    expect(applyNight(BASE_INTERVAL_MS, dayUtc)).toBe(BASE_INTERVAL_MS);
  });

  it('spreads calls with jitter inside the allowed band', () => {
    expect(withJitter(1_000, 0)).toBe(800);
    expect(withJitter(1_000, 1)).toBe(1_200);
  });

  it('boosts the last day and the sale-opening window', () => {
    const now = Date.UTC(2026, 8, 20, 12, 0);
    expect(departureBoost('2026-09-21', now)).toBe(2);
    expect(departureBoost('2026-11-04', now)).toBeGreaterThan(1);
    expect(departureBoost('2026-09-19', now)).toBe(0);
  });
});

describe('probe store', () => {
  let db: Db;

  beforeEach(() => {
    db = openDb(':memory:');
  });

  it('creates a probe row that is due immediately', () => {
    upsertProbe(db, candidate(), 1_000);
    expect(dueProbes(db, 1_000, 10)).toHaveLength(1);
  });

  it('treats the first answer as no change', () => {
    upsertProbe(db, candidate(), 1_000);
    expect(recordProbe(db, candidate(), 'hash-a', 1_000, () => 0.5).changed).toBe(false);
  });

  it('detects a change on a different hash and resets the interval', () => {
    upsertProbe(db, candidate(), 1_000);
    recordProbe(db, candidate(), 'hash-a', 1_000, () => 0.5);
    recordProbe(db, candidate(), 'hash-a', 2_000, () => 0.5);
    const grown = getProbe(db, candidate())!.intervalMs;
    const outcome = recordProbe(db, candidate(), 'hash-b', 3_000, () => 0.5);
    expect(outcome.changed).toBe(true);
    expect(outcome.intervalMs).toBeLessThan(grown);
    expect(getProbe(db, candidate())!.unchangedStreak).toBe(0);
  });

  it('counts unchanged answers in a streak', () => {
    upsertProbe(db, candidate(), 1_000);
    for (const t of [1_000, 2_000, 3_000]) recordProbe(db, candidate(), 'same', t, () => 0.5);
    expect(getProbe(db, candidate())!.unchangedStreak).toBe(2);
  });

  it('stops returning a probe until it is due again', () => {
    upsertProbe(db, candidate(), 1_000);
    const { nextDueAt } = recordProbe(db, candidate(), 'x', 1_000, () => 0.5);
    expect(dueProbes(db, 1_000, 10)).toHaveLength(0);
    expect(dueProbes(db, nextDueAt, 10)).toHaveLength(1);
  });

  it('ranks favourites above ordinary probes', () => {
    upsertProbe(db, candidate({ toId: 2 }), 1_000, true);
    upsertProbe(db, candidate({ toId: 3 }), 1_000, false);
    const rows = dueProbes(db, 1_000, 2);
    expect(rows[0]!.favorite).toBe(true);
    expect(scoreProbe(rows[0]!, 1_000)).toBeGreaterThan(scoreProbe(rows[1]!, 1_000));
  });

  it('ranks a direct pair above a weak detour', () => {
    upsertProbe(db, candidate({ toId: 2, weight: 1 }), 1_000);
    upsertProbe(db, candidate({ toId: 4, weight: 0.4, kind: 'neighbor_date' }), 1_000);
    expect(dueProbes(db, 1_000, 1)[0]!.toId).toBe(2);
  });

  it('keeps transfer mode as a separate probe', () => {
    upsertProbe(db, candidate({ withTransfers: false }), 1_000);
    upsertProbe(db, candidate({ withTransfers: true }), 1_000);
    expect(dueProbes(db, 1_000, 10)).toHaveLength(2);
  });
});
