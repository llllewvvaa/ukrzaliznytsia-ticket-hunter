import type { Db } from '../store/db.js';

export interface JourneyInput {
  trainNumber: string;
  fromId: number;
  departAt: number;
  arriveAt: number;
}

export interface Journey {
  departAt: number;
  arriveAt: number;
  durationMin: number;
  exact: boolean;
}

interface StopTime {
  stationId: number;
  arriveAt: number | null;
  departAt: number | null;
}

function stopTimes(db: Db, trainNumber: string): StopTime[] {
  const trip = db
    .prepare('select trip_id as tripId from trip_route where train_number = ? order by built_at desc limit 1')
    .get(trainNumber) as unknown as { tripId: number } | undefined;
  if (!trip) return [];
  return db
    .prepare(
      'select station_id as stationId, arrive_at as arriveAt, depart_at as departAt from trip_route where trip_id = ? order by seq',
    )
    .all(trip.tripId) as unknown as StopTime[];
}

// The atlas holds one dated run of each train; the gaps between its stops carry
// over to any other day, so the ticket's departure plus the stored gap gives the
// moment the train is at the owner's own boarding and alighting stations.
export function journeyTimes(db: Db, input: JourneyInput, boardId: number, alightId: number): Journey {
  const fallback: Journey = {
    departAt: input.departAt,
    arriveAt: input.arriveAt,
    durationMin: Math.max(0, Math.round((input.arriveAt - input.departAt) / 60)),
    exact: false,
  };

  const stops = stopTimes(db, input.trainNumber);
  const ticketStart = stops.find((stop) => stop.stationId === input.fromId);
  const board = stops.find((stop) => stop.stationId === boardId);
  const alight = stops.find((stop) => stop.stationId === alightId);
  const reference = ticketStart?.departAt ?? null;
  const boardAt = board?.departAt ?? board?.arriveAt ?? null;
  const alightAt = alight?.arriveAt ?? alight?.departAt ?? null;
  if (reference == null || boardAt == null || alightAt == null || !input.departAt) return fallback;

  const departAt = input.departAt + (boardAt - reference);
  const arriveAt = input.departAt + (alightAt - reference);
  if (arriveAt <= departAt) return fallback;
  return { departAt, arriveAt, durationMin: Math.round((arriveAt - departAt) / 60), exact: true };
}
