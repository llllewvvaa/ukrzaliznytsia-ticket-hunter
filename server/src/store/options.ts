import type { Db } from './db.js';
import { planCandidates } from '../brain/candidates.js';
import { refineKind } from '../brain/refine.js';
import { journeyTimes } from '../brain/journey.js';
import type { Leg } from '../brain/rank.js';
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
  arriveAt: number;
  journeyDepartAt: number;
  journeyArriveAt: number;
  durationMin: number;
  fromId: number;
  toId: number;
  fromName: string;
  toName: string;
  boardName: string;
  alightName: string;
  kind: string;
  why: string;
  segments: Leg[] | null;
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
  arriveAt: number;
  fromId: number;
  toId: number;
  kind: string;
  why: string;
  legsJson: string;
  takenAt: number;
}

function parseSegments(raw: string): Leg[] | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Leg[];
    return Array.isArray(value) && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

// Everything here comes from what the watcher already recorded, so opening a
// watch costs no request to UZ; the numbers are as fresh as the last check.
// A detour is shown only for a train that has no ordinary ticket that day —
// otherwise the plain ticket is the answer and the detour is noise.
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
              s.free_seats as freeSeats, s.price_kop as priceKop, s.depart_at as departAt, s.arrive_at as arriveAt,
              s.from_id as fromId, s.to_id as toId, s.source as kind, s.why, s.legs_json as legsJson,
              s.taken_at as takenAt
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

  const collected: WatchOption[] = [];
  for (const row of rows) {
    if (!planned.has(`${row.fromId}:${row.toId}:${row.date}`)) continue;
    const transfer = row.classId.startsWith('MIX');
    if (!transfer && watch.classes.length > 0 && !watch.classes.includes(row.classId)) continue;
    if (watch.maxPriceKop != null && row.priceKop > watch.maxPriceKop) continue;

    const refined = refineKind(db, row, watch.fromId, watch.toId);
    if (!refined) continue;

    const segments = parseSegments(row.legsJson);
    const journey = segments
      ? {
          departAt: segments[0]!.departAt,
          arriveAt: segments[segments.length - 1]!.arriveAt,
          durationMin: Math.round((segments[segments.length - 1]!.arriveAt - segments[0]!.departAt) / 60),
        }
      : journeyTimes(
          db,
          { trainNumber: row.trainNumber, fromId: row.fromId, departAt: row.departAt, arriveAt: row.arriveAt },
          refined.boardId,
          refined.alightId,
        );

    const announcedAt = announced.get(`${row.date}:${row.trainNumber}`);
    const { legsJson: _legs, ...rest } = row;
    collected.push({
      ...rest,
      kind: refined.kind,
      why: refined.why,
      journeyDepartAt: journey.departAt,
      journeyArriveAt: journey.arriveAt,
      durationMin: journey.durationMin,
      fromName: nameOf(row.fromId),
      toName: nameOf(row.toId),
      boardName: nameOf(refined.boardId),
      alightName: nameOf(refined.alightId),
      segments,
      isNew: announcedAt != null && (viewedBefore == null || announcedAt > viewedBefore),
    });
  }

  const hasPlainTicket = new Set(
    collected.filter((option) => option.kind === 'direct' || option.kind === 'neighbor_date').map((option) => `${option.date}:${option.trainNumber}`),
  );
  const options = collected.filter(
    (option) =>
      option.kind === 'direct' ||
      option.kind === 'neighbor_date' ||
      option.kind === 'transfers' ||
      !hasPlainTicket.has(`${option.date}:${option.trainNumber}`),
  );
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
