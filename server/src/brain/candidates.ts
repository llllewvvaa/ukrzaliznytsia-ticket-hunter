import type { Db } from '../store/db.js';
import { segmentOptions } from '../store/atlas.js';

export type CandidateKind =
  | 'direct'
  | 'transfers'
  | 'ride_further'
  | 'board_earlier'
  | 'neighbor_from'
  | 'neighbor_to'
  | 'neighbor_date'
  | 'alight_earlier';

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
  includeTransfers?: boolean;
  alightEarlierMin?: number;
}

export const KIND_WEIGHT: Record<CandidateKind, number> = {
  direct: 1,
  transfers: 0.7,
  ride_further: 0.6,
  board_earlier: 0.6,
  neighbor_from: 0.45,
  neighbor_to: 0.45,
  neighbor_date: 0.4,
  alight_earlier: 0.55,
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

function expandBack(dates: string[]): string[] {
  const out = new Set(dates);
  for (const date of dates) out.add(shiftDate(date, -1));
  return [...out].sort();
}

export function planCandidates(db: Db, request: CandidateRequest): Candidate[] {
  const {
    fromId,
    toId,
    dates,
    dateSlack = 0,
    maxExtraStops = 4,
    maxSegmentOptions = 8,
    includeTransfers = true,
    alightEarlierMin = 30,
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

  const all = segmentOptions(db, fromId, toId, alightEarlierMin);
  const longer = all
    .filter((option) => (option.kind === 'ride_further' || option.kind === 'board_earlier') && option.extraStops <= maxExtraStops)
    .slice(0, maxSegmentOptions);
  const shorter = all.filter((option) => option.kind === 'alight_earlier').slice(0, maxSegmentOptions);

  for (const segment of [...longer, ...shorter]) {
    const kind: CandidateKind =
      segment.kind === 'ride_further' ? 'ride_further' : segment.kind === 'alight_earlier' ? 'alight_earlier' : 'board_earlier';
    const why =
      kind === 'ride_further'
        ? `їхати далі до ${segment.toName} потягом ${segment.trainNumber}`
        : kind === 'alight_earlier'
          ? `вийти на ${segment.toName} за ${segment.gapMin ?? 0} хв до мети потягом ${segment.trainNumber}`
          : `сісти раніше на ${segment.fromName} потягом ${segment.trainNumber}`;
    // A train that passes the owner's station after midnight left the earlier
    // station the evening before, so boarding earlier also searches that day.
    const searchDates = kind === 'board_earlier' ? expandBack(dates) : dates;
    for (const date of searchDates) {
      push({ fromId: segment.fromId, toId: segment.toId, date, kind, withTransfers: false, weight: KIND_WEIGHT[kind], why });
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
