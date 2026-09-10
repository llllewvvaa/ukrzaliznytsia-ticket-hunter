import type { Db } from '../store/db.js';
import { GateTrippedError, type UzClient } from '../net/client.js';
import { parseSearch, parseTripDetail } from '../uz/parse.js';
import { searchTripsPath, tripDetailPath } from '../uz/paths.js';
import { buildPairIndex, saveTripRoute } from '../store/atlas.js';
import type { Trip } from '../uz/types.js';

export const ROUTE_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
export const SEARCH_TTL_MS = 60_000;
export const DETAIL_TTL_MS = 24 * 60 * 60 * 1_000;

export interface AtlasDeps {
  db: Db;
  client: UzClient;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  pacingMs?: number;
}

export interface AtlasBuildRequest {
  fromId: number;
  toId: number;
  dates: string[];
  withTransfers?: boolean;
}

export interface AtlasBuildResult {
  searched: number;
  tripsSeen: number;
  routesFetched: number;
  stopsStored: number;
  pairs: number;
  interrupted: boolean;
}

export function trainNeedsRoute(db: Db, trainId: number, now: number): boolean {
  const row = db
    .prepare('select updated_at as updatedAt from train where id = ?')
    .get(trainId) as unknown as { updatedAt: number | null } | undefined;
  const updatedAt = row?.updatedAt ?? null;
  return updatedAt == null || now - updatedAt > ROUTE_TTL_MS;
}

export function markTrainChecked(db: Db, trainId: number, number: string, now: number): void {
  db.prepare(
    'insert into train (id, number, updated_at) values (?, ?, ?) on conflict(id) do update set updated_at = excluded.updated_at',
  ).run(trainId, number, now);
}

export async function fetchAndStoreRoute(
  deps: AtlasDeps,
  tripId: number,
): Promise<number> {
  const now = deps.now ?? (() => Date.now());
  const res = await deps.client.get(tripDetailPath(tripId), { ttlMs: DETAIL_TTL_MS });
  if (res.kind !== 'ok') return 0;
  const detail = parseTripDetail(res.json());
  if (detail.routePoints.length === 0) return 0;
  return saveTripRoute(deps.db, detail, now());
}

export async function buildAtlas(
  deps: AtlasDeps,
  request: AtlasBuildRequest,
): Promise<AtlasBuildResult> {
  const now = deps.now ?? (() => Date.now());
  const sleep = deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const pacing = deps.pacingMs ?? 1_500;

  let searched = 0;
  let routesFetched = 0;
  let stopsStored = 0;
  let interrupted = false;
  const trips: Trip[] = [];

  // The atlas is a background chore; when the gate trips it stops and keeps what
  // it already has, instead of throwing and taking the watch cycle down with it.
  const guarded = async <T>(work: () => Promise<T>): Promise<T | null> => {
    try {
      return await work();
    } catch (error) {
      if (error instanceof GateTrippedError) {
        interrupted = true;
        return null;
      }
      throw error;
    }
  };

  for (const date of request.dates) {
    if (interrupted) break;
    const res = await guarded(() => deps.client.get(
      searchTripsPath({
        fromId: request.fromId,
        toId: request.toId,
        date,
        withTransfers: request.withTransfers ?? false,
      }),
      { ttlMs: SEARCH_TTL_MS },
    ));
    if (!res) break;
    searched += 1;
    if (res.kind !== 'ok') continue;
    const parsed = parseSearch(res.json());
    trips.push(...parsed.direct, ...parsed.withTransfer.flat());
    await sleep(pacing);
  }

  const wanted = new Map<number, Trip>();
  for (const trip of trips) {
    if (!wanted.has(trip.trainId) && trainNeedsRoute(deps.db, trip.trainId, now())) {
      wanted.set(trip.trainId, trip);
    }
  }

  for (const trip of wanted.values()) {
    if (interrupted) break;
    const stored = (await guarded(() => fetchAndStoreRoute(deps, trip.id))) ?? 0;
    // Only a stored route counts as checked; marking a failed fetch would hide
    // the train for a week and silently drop every detour that depends on it.
    if (stored > 0) {
      markTrainChecked(deps.db, trip.trainId, trip.trainNumber, now());
      routesFetched += 1;
      stopsStored += stored;
    }
    await sleep(pacing);
  }

  const pairs = buildPairIndex(deps.db, now());
  return { searched, tripsSeen: trips.length, routesFetched, stopsStored, pairs, interrupted };
}
