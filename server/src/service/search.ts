import type { Db } from '../store/db.js';
import type { UzClient } from '../net/client.js';
import { GateTrippedError } from '../net/client.js';
import { parseSearch, parseStations } from '../uz/parse.js';
import { searchTripsPath, stationsPath } from '../uz/paths.js';
import { planCandidates, type Candidate } from '../brain/candidates.js';
import { refineKind } from '../brain/refine.js';
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
  });

  const ordered = [...candidates].sort((a, b) => b.weight - a.weight);
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
        const refined = refineKind(deps.db, offer, request.fromId, request.toId);
        offers.push({ ...offer, kind: refined.kind, why: refined.why || offer.why });
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
    offers: dedupe(rankOffers(offers, request.filter ?? {}, undefined, request.sort ?? 'cheapest')),
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
