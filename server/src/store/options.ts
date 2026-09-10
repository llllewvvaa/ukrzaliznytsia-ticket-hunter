import type { Db } from './db.js';
import { planCandidates } from '../brain/candidates.js';
import { watchDates, type Watch } from './watches.js';
import { getMeta, setMeta } from './meta.js';

export const OPTIONS_FRESH_MS = 6 * 3_600_000;

export interface WatchOption {
  tripId: number;
  trainNumber: string;
  date: string;
  classId: string;
  freeSeats: number;
  priceKop: number;
  departAt: number;
  fromId: number;
  toId: number;
  fromName: string;
  toName: string;
  kind: string;
  why: string;
  takenAt: number;
  isNew: boolean;
}

export interface WatchOptions {
  options: WatchOption[];
  checkedAt: number | null;
  viewedBefore: number | null;
}

interface SnapshotRow {
  tripId: number;
  trainNumber: string;
  date: string;
  classId: string;
  freeSeats: number;
  priceKop: number;
  departAt: number;
  fromId: number;
  toId: number;
  kind: string;
  why: string;
  takenAt: number;
}

// Everything here comes from what the watcher already recorded, so opening a
// watch costs no request to UZ; the numbers are as fresh as the last check.
export function watchOptions(db: Db, watch: Watch, now: number): WatchOptions {
  const plan = planCandidates(db, {
    fromId: watch.fromId,
    toId: watch.toId,
    dates: watchDates(watch),
    dateSlack: 1,
  });
  const planned = new Set(plan.map((candidate) => `${candidate.fromId}:${candidate.toId}:${candidate.date}`));

  const rows = db
    .prepare(
      `select s.trip_id as tripId, s.train_number as trainNumber, s.date, s.class_id as classId,
              s.free_seats as freeSeats, s.price_kop as priceKop, s.depart_at as departAt,
              s.from_id as fromId, s.to_id as toId, s.source as kind, s.why, s.taken_at as takenAt
       from snapshot s
       join (
         select trip_id, class_id, from_id, to_id, date, max(taken_at) as latest
         from snapshot where taken_at > ?
         group by trip_id, class_id, from_id, to_id, date
       ) m on s.trip_id = m.trip_id and s.class_id = m.class_id and s.from_id = m.from_id
          and s.to_id = m.to_id and s.date = m.date and s.taken_at = m.latest
       where s.free_seats > 0`,
    )
    .all(now - OPTIONS_FRESH_MS) as unknown as SnapshotRow[];

  const stationName = db.prepare('select name from station where id = ?');
  const names = new Map<number, string>();
  const nameOf = (id: number): string => {
    const cached = names.get(id);
    if (cached != null) return cached;
    const row = stationName.get(id) as unknown as { name: string } | undefined;
    const name = row?.name ?? String(id);
    names.set(id, name);
    return name;
  };

  const announced = new Map<string, number>();
  for (const row of db
    .prepare(
      'select date, train_number as trainNumber, announced_at as announcedAt from announced where watch_id = ? and cleared_at is null',
    )
    .all(watch.id) as unknown as { date: string; trainNumber: string; announcedAt: number }[]) {
    announced.set(`${row.date}:${row.trainNumber}`, row.announcedAt);
  }

  const viewedRaw = getMeta(db, `viewed:${watch.id}`);
  const viewedBefore = viewedRaw ? Number(viewedRaw) : null;

  const options: WatchOption[] = [];
  for (const row of rows) {
    if (!planned.has(`${row.fromId}:${row.toId}:${row.date}`)) continue;
    const transfer = row.classId.startsWith('MIX');
    if (!transfer && watch.classes.length > 0 && !watch.classes.includes(row.classId)) continue;
    if (watch.maxPriceKop != null && row.priceKop > watch.maxPriceKop) continue;
    const announcedAt = announced.get(`${row.date}:${row.trainNumber}`);
    options.push({
      ...row,
      fromName: nameOf(row.fromId),
      toName: nameOf(row.toId),
      isNew: announcedAt != null && (viewedBefore == null || announcedAt > viewedBefore),
    });
  }
  options.sort((a, b) => a.date.localeCompare(b.date) || a.priceKop - b.priceKop);

  const probeRows = db
    .prepare('select from_id as fromId, to_id as toId, date, last_checked_at as checkedAt from probe')
    .all() as unknown as { fromId: number; toId: number; date: string; checkedAt: number }[];
  let checkedAt: number | null = null;
  for (const probe of probeRows) {
    if (!planned.has(`${probe.fromId}:${probe.toId}:${probe.date}`) || probe.checkedAt === 0) continue;
    checkedAt = Math.max(checkedAt ?? 0, probe.checkedAt);
  }

  return { options, checkedAt, viewedBefore };
}

export function markViewed(db: Db, watchId: string, now: number): void {
  setMeta(db, `viewed:${watchId}`, String(now));
}
