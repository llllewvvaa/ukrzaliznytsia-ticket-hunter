import type { Db } from '../store/db.js';
import type { Candidate } from '../brain/candidates.js';
import { BASE_INTERVAL_MS, applyNight, departureBoost, nextInterval, withJitter } from './interval.js';

export interface ProbeKey {
  fromId: number;
  toId: number;
  date: string;
  withTransfers: boolean;
}

export interface ProbeRow extends ProbeKey {
  lastCheckedAt: number;
  lastHash: string | null;
  unchangedStreak: number;
  intervalMs: number;
  nextDueAt: number;
  checks: number;
  changes: number;
  weight: number;
  favorite: boolean;
}

interface RawProbeRow {
  fromId: number;
  toId: number;
  date: string;
  withTransfers: number;
  lastCheckedAt: number;
  lastHash: string | null;
  unchangedStreak: number;
  intervalMs: number;
  nextDueAt: number;
  checks: number;
  changes: number;
  weight: number;
  favorite: number;
}

const SELECT = `select from_id as fromId, to_id as toId, date, with_transfers as withTransfers,
  last_checked_at as lastCheckedAt, last_hash as lastHash, unchanged_streak as unchangedStreak,
  interval_ms as intervalMs, next_due_at as nextDueAt, checks, changes, weight, favorite from probe`;

function hydrate(row: RawProbeRow): ProbeRow {
  return {
    fromId: row.fromId,
    toId: row.toId,
    date: row.date,
    withTransfers: row.withTransfers === 1,
    lastCheckedAt: row.lastCheckedAt,
    lastHash: row.lastHash,
    unchangedStreak: row.unchangedStreak,
    intervalMs: row.intervalMs,
    nextDueAt: row.nextDueAt,
    checks: row.checks,
    changes: row.changes,
    weight: row.weight,
    favorite: row.favorite === 1,
  };
}

export function upsertProbe(db: Db, candidate: Candidate, now: number, favorite = false): void {
  db.prepare(
    `insert into probe (from_id, to_id, date, with_transfers, last_checked_at, interval_ms, next_due_at, weight, favorite)
     values (?, ?, ?, ?, 0, ?, ?, ?, ?)
     on conflict(from_id, to_id, date, with_transfers) do update set
       weight = max(probe.weight, excluded.weight),
       favorite = max(probe.favorite, excluded.favorite)`,
  ).run(
    candidate.fromId,
    candidate.toId,
    candidate.date,
    candidate.withTransfers ? 1 : 0,
    BASE_INTERVAL_MS,
    now,
    candidate.weight,
    favorite ? 1 : 0,
  );
}

export function getProbe(db: Db, key: ProbeKey): ProbeRow | undefined {
  const row = db
    .prepare(`${SELECT} where from_id = ? and to_id = ? and date = ? and with_transfers = ?`)
    .get(key.fromId, key.toId, key.date, key.withTransfers ? 1 : 0) as unknown as RawProbeRow | undefined;
  return row ? hydrate(row) : undefined;
}

export function allProbes(db: Db): ProbeRow[] {
  return (db.prepare(SELECT).all() as unknown as RawProbeRow[]).map(hydrate);
}

export function scoreProbe(row: ProbeRow, now: number): number {
  const changeRate = row.checks > 0 ? row.changes / row.checks : 0.5;
  const overdueMin = Math.max(0, (now - row.nextDueAt) / 60_000);
  return (
    row.weight * 100 +
    changeRate * 80 +
    Math.min(overdueMin, 120) * 0.6 +
    departureBoost(row.date, now) * 30 +
    (row.favorite ? 120 : 0)
  );
}

export function probeKey(row: ProbeKey): string {
  return `${row.fromId}:${row.toId}:${row.date}:${row.withTransfers ? 1 : 0}`;
}

// Probes left over from a deleted watch or a moved date window are never checked
// again, so they stay overdue forever and their overdue bonus keeps growing. If
// selection ignored the plan they would outrank every live probe and starve the
// whole watcher, which is exactly how it once went quiet for hours.
export function dueProbes(db: Db, now: number, limit: number, planned?: ReadonlySet<string>): ProbeRow[] {
  const rows = (
    db.prepare(`${SELECT} where next_due_at <= ? order by next_due_at asc`).all(now) as unknown as RawProbeRow[]
  )
    .map(hydrate)
    .filter((row) => !planned || planned.has(probeKey(row)));
  return rows.sort((a, b) => scoreProbe(b, now) - scoreProbe(a, now)).slice(0, limit);
}

export function pruneOrphanProbes(db: Db, planned: ReadonlySet<string>, today: string): number {
  const rows = (db.prepare(SELECT).all() as unknown as RawProbeRow[]).map(hydrate);
  const remove = db.prepare(
    'delete from probe where from_id = ? and to_id = ? and date = ? and with_transfers = ?',
  );
  let removed = 0;
  for (const row of rows) {
    if (planned.has(probeKey(row))) continue;
    if (row.date >= today) continue;
    remove.run(row.fromId, row.toId, row.date, row.withTransfers ? 1 : 0);
    removed += 1;
  }
  return removed;
}

export interface ProbeOutcome {
  changed: boolean;
  intervalMs: number;
  nextDueAt: number;
}

export function recordProbe(
  db: Db,
  key: ProbeKey,
  hash: string,
  now: number,
  random: () => number = Math.random,
): ProbeOutcome {
  const existing = getProbe(db, key);
  const previousHash = existing?.lastHash ?? null;
  const first = previousHash === null;
  const changed = !first && previousHash !== hash;
  const baseInterval = existing?.intervalMs ?? BASE_INTERVAL_MS;
  const interval = first ? baseInterval : nextInterval(baseInterval, changed);
  const streak = first || changed ? 0 : (existing?.unchangedStreak ?? 0) + 1;
  const scheduled = withJitter(applyNight(interval, now), random());
  const nextDueAt = now + scheduled;

  db.prepare(
    `insert into probe (from_id, to_id, date, with_transfers, last_checked_at, last_hash, unchanged_streak, interval_ms, next_due_at, checks, changes, weight, favorite)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
     on conflict(from_id, to_id, date, with_transfers) do update set
       last_checked_at = excluded.last_checked_at,
       last_hash = excluded.last_hash,
       unchanged_streak = excluded.unchanged_streak,
       interval_ms = excluded.interval_ms,
       next_due_at = excluded.next_due_at,
       checks = probe.checks + 1,
       changes = probe.changes + excluded.changes`,
  ).run(
    key.fromId,
    key.toId,
    key.date,
    key.withTransfers ? 1 : 0,
    now,
    hash,
    streak,
    interval,
    nextDueAt,
    changed ? 1 : 0,
    existing?.weight ?? 1,
    existing?.favorite ? 1 : 0,
  );

  return { changed, intervalMs: interval, nextDueAt };
}

export function markFavorite(db: Db, key: ProbeKey, favorite: boolean): void {
  db.prepare(
    'update probe set favorite = ? where from_id = ? and to_id = ? and date = ? and with_transfers = ?',
  ).run(favorite ? 1 : 0, key.fromId, key.toId, key.date, key.withTransfers ? 1 : 0);
}
