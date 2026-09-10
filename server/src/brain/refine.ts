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
}

export function trainStops(db: Db, trainNumber: string): number[] {
  const trip = db
    .prepare('select trip_id as tripId from trip_route where train_number = ? order by built_at desc limit 1')
    .get(trainNumber) as unknown as { tripId: number } | undefined;
  if (!trip) return [];
  return (
    db.prepare('select station_id as stationId from trip_route where trip_id = ? order by seq').all(trip.tripId) as unknown as {
      stationId: number;
    }[]
  ).map((row) => row.stationId);
}

function stationName(db: Db, id: number): string {
  const row = db.prepare('select name from station where id = ?').get(id) as unknown as { name: string } | undefined;
  return row?.name ?? String(id);
}

// Path labels are planned per station pair, but one pair's search returns every
// train on it, and "board earlier at X" is only true for trains that pass X
// before the origin. Checking each train against its own stop order keeps the
// advice honest; without a known route the weaker neighbour label is used.
export function refineKind(db: Db, offer: RefineInput, origin: number, destination: number): Refined {
  const kind = offer.kind as CandidateKind;

  if (kind === 'transfers' && !offer.classId.startsWith('MIX')) {
    return { kind: 'direct', why: 'прямий напрямок' };
  }

  if (kind === 'board_earlier') {
    const stops = trainStops(db, offer.trainNumber);
    const at = (id: number): number => stops.indexOf(id);
    const boardsFrom = at(offer.fromId);
    const passesOrigin = at(origin);
    const reaches = at(destination);
    if (boardsFrom >= 0 && passesOrigin > boardsFrom && (reaches < 0 || reaches > passesOrigin)) {
      return { kind, why: `квиток від ${stationName(db, offer.fromId)}, посадка у ${stationName(db, origin)}` };
    }
    return { kind: 'neighbor_from', why: `виїзд із сусідньої станції ${stationName(db, offer.fromId)}` };
  }

  if (kind === 'ride_further') {
    const stops = trainStops(db, offer.trainNumber);
    const at = (id: number): number => stops.indexOf(id);
    const endsAt = at(offer.toId);
    const passesDestination = at(destination);
    const startsAt = at(origin);
    if (endsAt >= 0 && passesDestination >= 0 && passesDestination < endsAt && (startsAt < 0 || startsAt < passesDestination)) {
      return { kind, why: `квиток до ${stationName(db, offer.toId)}, вихід у ${stationName(db, destination)}` };
    }
    return { kind: 'neighbor_to', why: `прибуття на сусідню станцію ${stationName(db, offer.toId)}` };
  }

  return { kind, why: '' };
}
