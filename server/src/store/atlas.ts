import type { Db } from './db.js';
import type { TripDetail } from '../uz/types.js';

export interface RouteStop {
  tripId: number;
  seq: number;
  trainId: number;
  trainNumber: string;
  stationId: number;
  stationName: string;
  arriveAt: number | null;
  departAt: number | null;
}

export interface SegmentOption {
  trainNumber: string;
  trainId: number;
  fromId: number;
  fromName: string;
  toId: number;
  toName: string;
  kind: 'ride_further' | 'board_earlier' | 'direct';
  extraStops: number;
}

export function upsertStation(db: Db, id: number, name: string, now: number): void {
  db.prepare(
    'insert into station (id, name, updated_at) values (?, ?, ?) on conflict(id) do update set name = excluded.name, updated_at = excluded.updated_at',
  ).run(id, name, now);
}

export function saveTripRoute(db: Db, detail: TripDetail, now: number): number {
  const insert = db.prepare(
    'insert or replace into trip_route (trip_id, seq, train_id, train_number, station_id, station_name, arrive_at, depart_at, built_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  );
  db.prepare(
    'insert into train (id, number, updated_at) values (?, ?, ?) on conflict(id) do update set number = excluded.number, updated_at = excluded.updated_at',
  ).run(detail.trainId, detail.trainNumber, now);

  for (const point of detail.routePoints) {
    insert.run(
      detail.id,
      point.seq,
      detail.trainId,
      detail.trainNumber,
      point.stationId,
      point.stationName,
      point.arriveAt,
      point.departAt,
      now,
    );
    upsertStation(db, point.stationId, point.stationName, now);
  }
  return detail.routePoints.length;
}

export function routeOf(db: Db, tripId: number): RouteStop[] {
  return db
    .prepare(
      'select trip_id as tripId, seq, train_id as trainId, train_number as trainNumber, station_id as stationId, station_name as stationName, arrive_at as arriveAt, depart_at as departAt from trip_route where trip_id = ? order by seq',
    )
    .all(tripId) as unknown as RouteStop[];
}

export function knownTripIds(db: Db, trainId: number): number[] {
  const rows = db
    .prepare('select distinct trip_id as tripId from trip_route where train_id = ?')
    .all(trainId) as unknown as { tripId: number }[];
  return rows.map((r) => r.tripId);
}

export function buildPairIndex(db: Db, now: number): number {
  db.exec('delete from pair_index');
  const trips = db.prepare('select distinct trip_id as tripId from trip_route').all() as unknown as {
    tripId: number;
  }[];
  const pairs = new Map<string, Set<number>>();

  for (const { tripId } of trips) {
    const stops = routeOf(db, tripId);
    for (let i = 0; i < stops.length; i += 1) {
      for (let j = i + 1; j < stops.length; j += 1) {
        const key = `${stops[i]!.stationId}:${stops[j]!.stationId}`;
        const bucket = pairs.get(key) ?? new Set<number>();
        bucket.add(stops[i]!.trainId);
        pairs.set(key, bucket);
      }
    }
  }

  const insert = db.prepare(
    'insert or replace into pair_index (from_id, to_id, train_ids, last_built_at) values (?, ?, ?, ?)',
  );
  for (const [key, trains] of pairs) {
    const [fromId, toId] = key.split(':').map(Number);
    insert.run(fromId!, toId!, JSON.stringify([...trains]), now);
  }
  return pairs.size;
}

export function trainsForPair(db: Db, fromId: number, toId: number): number[] {
  const row = db
    .prepare('select train_ids as trainIds from pair_index where from_id = ? and to_id = ?')
    .get(fromId, toId) as unknown as { trainIds: string } | undefined;
  return row ? (JSON.parse(row.trainIds) as number[]) : [];
}

export function neighborStations(db: Db, stationId: number, hops = 1): { id: number; name: string }[] {
  const rows = db
    .prepare(
      `select distinct other.station_id as id, other.station_name as name
       from trip_route origin
       join trip_route other on other.trip_id = origin.trip_id
       where origin.station_id = ?
         and other.station_id != origin.station_id
         and abs(other.seq - origin.seq) <= ?`,
    )
    .all(stationId, hops) as unknown as { id: number; name: string }[];
  return rows;
}

export function segmentOptions(db: Db, fromId: number, toId: number): SegmentOption[] {
  const rows = db
    .prepare(
      `select a.train_id as trainId, a.train_number as trainNumber, a.trip_id as tripId,
              a.seq as fromSeq, b.seq as toSeq
       from trip_route a
       join trip_route b on b.trip_id = a.trip_id
       where a.station_id = ? and b.station_id = ? and b.seq > a.seq`,
    )
    .all(fromId, toId) as unknown as {
    trainId: number;
    trainNumber: string;
    tripId: number;
    fromSeq: number;
    toSeq: number;
  }[];

  const options: SegmentOption[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const stops = routeOf(db, row.tripId);
    const fromStop = stops[row.fromSeq]!;
    const toStop = stops[row.toSeq]!;

    push({
      trainId: row.trainId,
      trainNumber: row.trainNumber,
      fromId: fromStop.stationId,
      fromName: fromStop.stationName,
      toId: toStop.stationId,
      toName: toStop.stationName,
      kind: 'direct',
      extraStops: 0,
    });

    for (let j = row.toSeq + 1; j < stops.length; j += 1) {
      push({
        trainId: row.trainId,
        trainNumber: row.trainNumber,
        fromId: fromStop.stationId,
        fromName: fromStop.stationName,
        toId: stops[j]!.stationId,
        toName: stops[j]!.stationName,
        kind: 'ride_further',
        extraStops: j - row.toSeq,
      });
    }

    for (let i = row.fromSeq - 1; i >= 0; i -= 1) {
      push({
        trainId: row.trainId,
        trainNumber: row.trainNumber,
        fromId: stops[i]!.stationId,
        fromName: stops[i]!.stationName,
        toId: toStop.stationId,
        toName: toStop.stationName,
        kind: 'board_earlier',
        extraStops: row.fromSeq - i,
      });
    }
  }

  function push(option: SegmentOption): void {
    if (option.fromId === option.toId) return;
    const key = `${option.trainId}:${option.fromId}:${option.toId}`;
    if (seen.has(key)) return;
    seen.add(key);
    options.push(option);
  }

  options.sort((a, b) => a.extraStops - b.extraStops || a.trainNumber.localeCompare(b.trainNumber));
  return options;
}

export function atlasStats(db: Db): { stations: number; trains: number; trips: number; pairs: number } {
  const one = (sql: string): number =>
    (db.prepare(sql).get() as unknown as { n: number }).n;
  return {
    stations: one('select count(*) as n from station'),
    trains: one('select count(*) as n from train'),
    trips: one('select count(distinct trip_id) as n from trip_route'),
    pairs: one('select count(*) as n from pair_index'),
  };
}
