import type { Db } from './db.js';
import type { Offer } from '../brain/rank.js';
import type { Wagon } from '../uz/types.js';

export interface AvailabilitySample {
  tripId: number;
  trainNumber: string;
  classId: string;
  className: string;
  freeSeats: number;
  priceKop: number;
  departAt: number;
}

export interface StoredEvent {
  id: number;
  watchId: string;
  kind: string;
  payload: Record<string, unknown>;
  createdAt: number;
  notifiedAt: number | null;
}

export function recordSnapshots(
  db: Db,
  takenAt: number,
  key: { fromId: number; toId: number; date: string; source: string; why?: string },
  samples: AvailabilitySample[],
): void {
  const insert = db.prepare(
    `insert into snapshot (taken_at, from_id, to_id, date, trip_id, train_number, class_id, free_seats, price_kop, source, depart_at, why)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const sample of samples) {
    insert.run(
      takenAt,
      key.fromId,
      key.toId,
      key.date,
      sample.tripId,
      sample.trainNumber,
      sample.classId,
      sample.freeSeats,
      sample.priceKop,
      key.source,
      sample.departAt,
      key.why ?? '',
    );
  }
}

export function lastSamples(
  db: Db,
  key: { fromId: number; toId: number; date: string },
  beforeTs: number,
): Map<string, AvailabilitySample> {
  const rows = db
    .prepare(
      `select trip_id as tripId, train_number as trainNumber, class_id as classId,
              free_seats as freeSeats, price_kop as priceKop, max(taken_at) as takenAt
       from snapshot
       where from_id = ? and to_id = ? and date = ? and taken_at < ?
       group by trip_id, class_id`,
    )
    .all(key.fromId, key.toId, key.date, beforeTs) as unknown as (AvailabilitySample & {
    takenAt: number;
  })[];
  const out = new Map<string, AvailabilitySample>();
  for (const row of rows) {
    out.set(`${row.tripId}:${row.classId}`, {
      tripId: row.tripId,
      trainNumber: row.trainNumber,
      classId: row.classId,
      className: row.classId,
      freeSeats: row.freeSeats,
      priceKop: row.priceKop,
      departAt: 0,
    });
  }
  return out;
}

export function samplesFromOffers(offers: Offer[]): AvailabilitySample[] {
  return offers.map((offer) => ({
    tripId: offer.tripId,
    trainNumber: offer.trainNumber,
    classId: offer.classId,
    className: offer.className,
    freeSeats: offer.freeSeats,
    priceKop: offer.priceKop,
    departAt: offer.departAt,
  }));
}

export function recordSeatSnapshot(
  db: Db,
  takenAt: number,
  tripId: number,
  classId: string,
  wagons: Wagon[],
): void {
  const insert = db.prepare(
    `insert into seat_snapshot (taken_at, trip_id, class_id, wagon_number, wagon_key, seats_json, free_lower, free_top, price_kop)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const wagon of wagons) {
    insert.run(
      takenAt,
      tripId,
      classId,
      wagon.number,
      wagon.wagonKey,
      JSON.stringify(wagon.seats),
      wagon.freeSeatsLower,
      wagon.freeSeatsTop,
      wagon.priceKop,
    );
  }
}

export function insertEvent(
  db: Db,
  watchId: string,
  kind: string,
  payload: Record<string, unknown>,
  createdAt: number,
): number {
  const info = db
    .prepare('insert into event (watch_id, kind, payload_json, created_at, notified_at) values (?, ?, ?, ?, null)')
    .run(watchId, kind, JSON.stringify(payload), createdAt);
  return Number(info.lastInsertRowid);
}

export function pendingEvents(db: Db, limit = 50): StoredEvent[] {
  const rows = db
    .prepare(
      `select id, watch_id as watchId, kind, payload_json as payload, created_at as createdAt, notified_at as notifiedAt
       from event where notified_at is null order by created_at limit ?`,
    )
    .all(limit) as unknown as (Omit<StoredEvent, 'payload'> & { payload: string })[];
  return rows.map((row) => ({ ...row, payload: JSON.parse(row.payload) as Record<string, unknown> }));
}

export function markNotified(db: Db, ids: number[], now: number): void {
  const update = db.prepare('update event set notified_at = ? where id = ?');
  for (const id of ids) update.run(now, id);
}

export function rememberRoute(
  db: Db,
  watchId: string,
  routeKey: string,
  route: Record<string, unknown>,
  now: number,
): void {
  db.prepare(
    `insert into route_memory (watch_id, route_key, route_json, first_seen_at, last_hit_at, hits)
     values (?, ?, ?, ?, ?, 1)
     on conflict(watch_id, route_key) do update set
       last_hit_at = excluded.last_hit_at,
       hits = route_memory.hits + 1,
       route_json = excluded.route_json`,
  ).run(watchId, routeKey, JSON.stringify(route), now, now);
}

export function knownRoutes(db: Db, watchId: string): { routeKey: string; hits: number; route: Record<string, unknown> }[] {
  const rows = db
    .prepare(
      'select route_key as routeKey, hits, route_json as route from route_memory where watch_id = ? order by hits desc, last_hit_at desc',
    )
    .all(watchId) as unknown as { routeKey: string; hits: number; route: string }[];
  return rows.map((row) => ({ ...row, route: JSON.parse(row.route) as Record<string, unknown> }));
}

export function priceHistory(
  db: Db,
  tripId: number,
  classId: string,
  limit = 100,
): { takenAt: number; priceKop: number; freeSeats: number }[] {
  return db
    .prepare(
      `select taken_at as takenAt, price_kop as priceKop, free_seats as freeSeats
       from snapshot where trip_id = ? and class_id = ? order by taken_at desc limit ?`,
    )
    .all(tripId, classId, limit) as unknown as { takenAt: number; priceKop: number; freeSeats: number }[];
}
