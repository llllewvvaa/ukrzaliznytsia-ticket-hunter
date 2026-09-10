import type { Db } from '../store/db.js';
import type { StoredEvent } from '../store/history.js';
import type { Watch } from '../store/watches.js';
import { hryvnia, shortDate } from '../service/format.js';

export const ANNOUNCE_GAP_MS = 5 * 60_000;
export const CLEAR_AFTER_MS = 20 * 60_000;

export interface NewTrain {
  date: string;
  trainNumber: string;
  priceKop: number;
}

export interface DateGroup {
  date: string;
  trains: string[];
  cheapestKop: number;
}

// One train can surface through several candidate paths (direct, riding further,
// a neighbouring station) and several classes at once; for the owner that is one
// fact — tickets exist on that train that day — so the key is date plus train.
export function newTrainsFrom(events: StoredEvent[]): NewTrain[] {
  const byKey = new Map<string, NewTrain>();
  for (const event of events) {
    if (event.kind !== 'appeared') continue;
    const payload = event.payload as Record<string, unknown>;
    const date = String(payload.date ?? '');
    const trainNumber = String(payload.trainNumber ?? '');
    if (!date || !trainNumber) continue;
    const priceKop = Number(payload.priceKop ?? 0);
    const key = `${date}:${trainNumber}`;
    const current = byKey.get(key);
    if (!current || (priceKop > 0 && priceKop < current.priceKop)) {
      byKey.set(key, { date, trainNumber, priceKop });
    }
  }
  return [...byKey.values()];
}

export function groupByDate(trains: NewTrain[]): DateGroup[] {
  const groups = new Map<string, DateGroup>();
  for (const train of trains) {
    const group = groups.get(train.date) ?? { date: train.date, trains: [], cheapestKop: Number.POSITIVE_INFINITY };
    if (!group.trains.includes(train.trainNumber)) group.trains.push(train.trainNumber);
    if (train.priceKop > 0) group.cheapestKop = Math.min(group.cheapestKop, train.priceKop);
    groups.set(train.date, group);
  }
  return [...groups.values()]
    .map((group) => ({ ...group, trains: [...group.trains].sort() }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function announcementText(watch: Pick<Watch, 'name'>, groups: DateGroup[]): string {
  const lines = [`Нові квитки · ${watch.name}`];
  for (const group of groups) {
    const price = Number.isFinite(group.cheapestKop) ? ` · від ${hryvnia(group.cheapestKop)}` : '';
    lines.push(`${shortDate(group.date)} — ${group.trains.join(', ')}${price}`);
  }
  return lines.join('\n');
}

export function alreadyAnnounced(db: Db, watchId: string, date: string, trainNumber: string): boolean {
  const row = db
    .prepare(
      'select 1 as hit from announced where watch_id = ? and date = ? and train_number = ? and cleared_at is null',
    )
    .get(watchId, date, trainNumber) as unknown as { hit: number } | undefined;
  return row != null;
}

export function markAnnounced(db: Db, watchId: string, trains: NewTrain[], now: number): void {
  const upsert = db.prepare(
    `insert into announced (watch_id, date, train_number, announced_at, cleared_at)
     values (?, ?, ?, ?, null)
     on conflict(watch_id, date, train_number) do update set announced_at = excluded.announced_at, cleared_at = null`,
  );
  for (const train of trains) upsert.run(watchId, train.date, train.trainNumber, now);
}

// A train stops counting as announced once no path has shown it with seats for a
// while, so tickets that vanish and come back are news again.
export function clearVanished(db: Db, now: number, quietMs = CLEAR_AFTER_MS): number {
  const open = db
    .prepare('select watch_id as watchId, date, train_number as trainNumber from announced where cleared_at is null')
    .all() as unknown as { watchId: string; date: string; trainNumber: string }[];
  const seen = db.prepare(
    'select 1 as hit from snapshot where train_number = ? and date = ? and free_seats > 0 and taken_at > ? limit 1',
  );
  const clear = db.prepare(
    'update announced set cleared_at = ? where watch_id = ? and date = ? and train_number = ?',
  );
  let cleared = 0;
  for (const row of open) {
    if (seen.get(row.trainNumber, row.date, now - quietMs)) continue;
    clear.run(now, row.watchId, row.date, row.trainNumber);
    cleared += 1;
  }
  return cleared;
}
