import type { Db } from '../store/db.js';
import type { CandidateKind } from './candidates.js';

export interface RefineInput {
  kind: string;
  classId: string;
  trainNumber: string;
  fromId: number;
  toId: number;
}

export interface Refined {
  kind: CandidateKind;
  why: string;
  boardId: number;
  alightId: number;
}

export function trainStops(db: Db, trainNumber: string): number[] {
  const trip = db
    .prepare(
      'select trip_id as tripId from trip_route where train_number = ? order by built_at desc limit 1',
    )
    .get(trainNumber) as unknown as { tripId: number } | undefined;
  if (!trip) return [];
  return (
    db
      .prepare('select station_id as stationId from trip_route where trip_id = ? order by seq')
      .all(trip.tripId) as unknown as {
      stationId: number;
    }[]
  ).map((row) => row.stationId);
}

function arrivalTimes(db: Db, trainNumber: string): Map<number, number> {
  const trip = db
    .prepare(
      'select trip_id as tripId from trip_route where train_number = ? order by built_at desc limit 1',
    )
    .get(trainNumber) as unknown as { tripId: number } | undefined;
  const out = new Map<number, number>();
  if (!trip) return out;
  const rows = db
    .prepare(
      'select station_id as stationId, arrive_at as arriveAt, depart_at as departAt from trip_route where trip_id = ? order by seq',
    )
    .all(trip.tripId) as unknown as {
    stationId: number;
    arriveAt: number | null;
    departAt: number | null;
  }[];
  for (const row of rows) {
    const at = row.arriveAt ?? row.departAt;
    if (at != null) out.set(row.stationId, at);
  }
  return out;
}

function stationName(db: Db, id: number): string {
  const row = db.prepare('select name from station where id = ?').get(id) as unknown as
    { name: string } | undefined;
  return row?.name ?? String(id);
}

// A detour ticket is only worth showing when it carries the owner the whole way:
// bought from a station the train passes before the origin, or to one it
// reaches after the destination. Anything that ends short of the destination or
// starts after the origin would strand them, so it is dropped (null), and so is
// any detour whose train route the atlas does not know yet.
export interface RefineOptions {
  alightEarlierMin?: number;
}

export function refineKind(
  db: Db,
  offer: RefineInput,
  origin: number,
  destination: number,
  options: RefineOptions = {},
): Refined | null {
  const kind = offer.kind as CandidateKind;

  // Getting off early is the one shortfall worth offering: the train still
  // reaches the destination a few minutes later, so the owner is effectively
  // there. It must board at the origin, stop before the destination, and the
  // train's own timetable must put that stop within the owner's limit.
  if (kind === 'alight_earlier') {
    const limit = options.alightEarlierMin ?? 30;
    if (limit <= 0 || offer.fromId !== origin) return null;
    const stops = trainStops(db, offer.trainNumber);
    const boards = stops.indexOf(origin);
    const leaves = stops.indexOf(offer.toId);
    const reaches = stops.indexOf(destination);
    if (boards < 0 || leaves <= boards || reaches <= leaves) return null;
    const times = arrivalTimes(db, offer.trainNumber);
    const leaveAt = times.get(offer.toId);
    const reachAt = times.get(destination);
    if (leaveAt == null || reachAt == null) return null;
    const gapMin = Math.round((reachAt - leaveAt) / 60);
    if (gapMin < 0 || gapMin > limit) return null;
    return {
      kind,
      why: `квиток до ${stationName(db, offer.toId)}, далі ${gapMin} хв у тамбурі до ${stationName(db, destination)}`,
      boardId: origin,
      alightId: offer.toId,
    };
  }

  if (kind === 'direct' || kind === 'neighbor_date') {
    return { kind, why: '', boardId: offer.fromId, alightId: offer.toId };
  }

  if (kind === 'transfers') {
    return offer.classId.startsWith('MIX')
      ? { kind, why: 'з пересадкою', boardId: offer.fromId, alightId: offer.toId }
      : { kind: 'direct', why: '', boardId: offer.fromId, alightId: offer.toId };
  }

  if (kind === 'board_earlier' || kind === 'ride_further') {
    const stops = trainStops(db, offer.trainNumber);
    const at = (id: number): number => stops.indexOf(id);
    const ticketFrom = at(offer.fromId);
    const ticketTo = at(offer.toId);
    const boards = at(origin);
    const alights = at(destination);
    const covers =
      ticketFrom >= 0 &&
      ticketTo >= 0 &&
      boards >= 0 &&
      alights >= 0 &&
      ticketFrom <= boards &&
      boards < alights &&
      alights <= ticketTo;
    if (!covers) return null;

    const parts: string[] = [];
    if (offer.fromId !== origin)
      parts.push(
        `квиток від ${stationName(db, offer.fromId)}, посадка у ${stationName(db, origin)}`,
      );
    if (offer.toId !== destination)
      parts.push(
        `квиток до ${stationName(db, offer.toId)}, вихід у ${stationName(db, destination)}`,
      );
    return {
      kind: offer.fromId !== origin ? 'board_earlier' : 'ride_further',
      why: parts.join('; '),
      boardId: origin,
      alightId: destination,
    };
  }

  return null;
}
