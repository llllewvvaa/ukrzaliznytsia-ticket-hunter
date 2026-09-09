import type { Db } from '../store/db.js';
import { neighborStations, segmentOptions } from '../store/atlas.js';

export type CandidateKind =
  | 'direct'
  | 'transfers'
  | 'ride_further'
  | 'board_earlier'
  | 'neighbor_from'
  | 'neighbor_to'
  | 'neighbor_date';

export interface Candidate {
  fromId: number;
  toId: number;
  date: string;
  kind: CandidateKind;
  withTransfers: boolean;
  weight: number;
  why: string;
}

export interface CandidateRequest {
  fromId: number;
  toId: number;
  dates: string[];
  dateSlack?: number;
  maxExtraStops?: number;
  maxSegmentOptions?: number;
  maxNeighbors?: number;
  includeTransfers?: boolean;
}

export const KIND_WEIGHT: Record<CandidateKind, number> = {
  direct: 1,
  transfers: 0.7,
  ride_further: 0.6,
  board_earlier: 0.6,
  neighbor_from: 0.45,
  neighbor_to: 0.45,
  neighbor_date: 0.4,
};

export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function expandDates(dates: string[], slack: number): string[] {
  const out = new Set(dates);
  for (const date of dates) {
    for (let i = 1; i <= slack; i += 1) {
      out.add(shiftDate(date, i));
      out.add(shiftDate(date, -i));
    }
  }
  return [...out].sort();
}

export function planCandidates(db: Db, request: CandidateRequest): Candidate[] {
  const {
    fromId,
    toId,
    dates,
    dateSlack = 0,
    maxExtraStops = 2,
    maxSegmentOptions = 6,
    maxNeighbors = 3,
    includeTransfers = true,
  } = request;

  const out: Candidate[] = [];
  const seen = new Set<string>();

  const push = (candidate: Candidate): void => {
    if (candidate.fromId === candidate.toId) return;
    const key = `${candidate.fromId}:${candidate.toId}:${candidate.date}:${candidate.withTransfers ? 1 : 0}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(candidate);
  };

  for (const date of dates) {
    push({
      fromId,
      toId,
      date,
      kind: 'direct',
      withTransfers: false,
      weight: KIND_WEIGHT.direct,
      why: 'прямий напрямок',
    });
    if (includeTransfers) {
      push({
        fromId,
        toId,
        date,
        kind: 'transfers',
        withTransfers: true,
        weight: KIND_WEIGHT.transfers,
        why: 'пересадки від УЗ',
      });
    }
  }

  const segments = segmentOptions(db, fromId, toId)
    .filter((option) => option.kind !== 'direct' && option.extraStops <= maxExtraStops)
    .slice(0, maxSegmentOptions);

  for (const segment of segments) {
    for (const date of dates) {
      push({
        fromId: segment.fromId,
        toId: segment.toId,
        date,
        kind: segment.kind === 'ride_further' ? 'ride_further' : 'board_earlier',
        withTransfers: false,
        weight: KIND_WEIGHT[segment.kind === 'ride_further' ? 'ride_further' : 'board_earlier'],
        why:
          segment.kind === 'ride_further'
            ? `їхати далі до ${segment.toName} потягом ${segment.trainNumber}`
            : `сісти раніше на ${segment.fromName} потягом ${segment.trainNumber}`,
      });
    }
  }

  const originNeighbors = neighborStations(db, fromId, 1).filter((station) => station.id !== toId);
  for (const neighbor of originNeighbors.slice(0, maxNeighbors)) {
    for (const date of dates) {
      push({
        fromId: neighbor.id,
        toId,
        date,
        kind: 'neighbor_from',
        withTransfers: false,
        weight: KIND_WEIGHT.neighbor_from,
        why: `виїзд із сусідньої станції ${neighbor.name}`,
      });
    }
  }

  const destinationNeighbors = neighborStations(db, toId, 1).filter((station) => station.id !== fromId);
  for (const neighbor of destinationNeighbors.slice(0, maxNeighbors)) {
    for (const date of dates) {
      push({
        fromId,
        toId: neighbor.id,
        date,
        kind: 'neighbor_to',
        withTransfers: false,
        weight: KIND_WEIGHT.neighbor_to,
        why: `прибуття на сусідню станцію ${neighbor.name}`,
      });
    }
  }

  if (dateSlack > 0) {
    for (const date of expandDates(dates, dateSlack)) {
      if (dates.includes(date)) continue;
      push({
        fromId,
        toId,
        date,
        kind: 'neighbor_date',
        withTransfers: false,
        weight: KIND_WEIGHT.neighbor_date,
        why: 'сусідня дата',
      });
    }
  }

  return out;
}

export function networkCost(candidates: Candidate[]): number {
  const pairs = new Set(candidates.map((c) => `${c.fromId}:${c.toId}:${c.date}:${c.withTransfers ? 1 : 0}`));
  return pairs.size;
}
