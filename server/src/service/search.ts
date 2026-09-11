import type { Db } from '../store/db.js';
import type { UzClient } from '../net/client.js';
import { GateTrippedError } from '../net/client.js';
import { parseSearch, parseStations } from '../uz/parse.js';
import { searchTripsPath, stationsPath } from '../uz/paths.js';
import { planCandidates, type Candidate } from '../brain/candidates.js';
import { refineKind } from '../brain/refine.js';
import { journeyTimes } from '../brain/journey.js';
import { travelDate } from '../brain/travel-date.js';
import { applyTiers } from '../brain/tiers.js';
import { offersFromSearch, rankOffers, type Offer, type OfferFilter, type SortMode } from '../brain/rank.js';

export interface FindWaysRequest {
  fromId: number;
  toId: number;
  dates: string[];
  dateSlack?: number;
  maxRequests?: number;
  filter?: OfferFilter;
  ttlMs?: number;
  sort?: SortMode;
  alightEarlierMin?: number;
}

export interface FindWaysResult {
  offers: Offer[];
  requests: number;
  candidates: number;
  gated: boolean;
}

export async function findWays(
  deps: { db: Db; client: UzClient },
  request: FindWaysRequest,
): Promise<FindWaysResult> {
  const candidates = planCandidates(deps.db, {
    fromId: request.fromId,
    toId: request.toId,
    dates: request.dates,
    dateSlack: request.dateSlack ?? 0,
    alightEarlierMin: request.alightEarlierMin ?? 30,
  });

  const ordered = [...candidates].sort((a, b) => b.weight - a.weight);
  const wanted = new Set(
    (request.dateSlack ?? 0) > 0
      ? candidates.map((candidate) => candidate.date).concat(request.dates)
      : request.dates,
  );
  const budget = request.maxRequests ?? 12;
  const offers: Offer[] = [];
  let requests = 0;
  let gated = false;

  for (const candidate of ordered) {
    if (requests >= budget) break;
    try {
      const res = await deps.client.get(pathFor(candidate), {
        ttlMs: request.ttlMs ?? 60_000,
        priority: 'interactive',
      });
      requests += 1;
      if (res.kind !== 'ok') continue;
      for (const offer of offersFromSearch(parseSearch(res.json()), candidate)) {
        const refined = refineKind(deps.db, offer, request.fromId, request.toId, {
          alightEarlierMin: request.alightEarlierMin ?? 30,
        });
        if (!refined) continue;
        const journey = offer.segments
          ? { departAt: offer.departAt, arriveAt: offer.arriveAt, durationMin: offer.durationMin }
          : journeyTimes(deps.db, offer, refined.boardId, refined.alightId);
        const date = travelDate(offer.date, journey.departAt);
        if (!wanted.has(date)) continue;
        offers.push({
          ...offer,
          date,
          kind: refined.kind,
          why: refined.why || offer.why,
          departAt: journey.departAt,
          arriveAt: journey.arriveAt,
          durationMin: journey.durationMin,
        });
      }
    } catch (error) {
      if (error instanceof GateTrippedError) {
        gated = true;
        break;
      }
      throw error;
    }
  }

  return {
    offers: dedupe(rankOffers(applyTiers(offers), request.filter ?? {}, undefined, request.sort ?? 'cheapest')),
    requests,
    candidates: candidates.length,
    gated,
  };
}

function pathFor(candidate: Candidate): string {
  return searchTripsPath({
    fromId: candidate.fromId,
    toId: candidate.toId,
    date: candidate.date,
    withTransfers: candidate.withTransfers,
  });
}

function dedupe(offers: Offer[]): Offer[] {
  const seen = new Set<string>();
  const out: Offer[] = [];
  for (const offer of offers) {
    const key = `${offer.tripId}:${offer.classId}:${offer.fromId}:${offer.toId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(offer);
  }
  return out;
}

export async function lookupStations(client: UzClient, query: string) {
  const res = await client.get(stationsPath(query), {
    ttlMs: 24 * 60 * 60 * 1_000,
    priority: 'interactive',
  });
  if (res.kind !== 'ok') return [];
  return parseStations(res.json());
}
