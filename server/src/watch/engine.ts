import type { Db } from '../store/db.js';
import type { UzClient } from '../net/client.js';
import { GateTrippedError } from '../net/client.js';
import { TransportTimeoutError } from '../net/browser.js';
import { parseSearch, parseWagons } from '../uz/parse.js';
import { searchTripsPath, wagonsByClassPath } from '../uz/paths.js';
import { planCandidates, type Candidate } from '../brain/candidates.js';
import { isTransferClass, offersFromSearch, rankOffers, type Offer } from '../brain/rank.js';
import { refineKind, type Refined } from '../brain/refine.js';
import { journeyTimes } from '../brain/journey.js';
import {
  insertEvent,
  lastSamples,
  recordSeatSnapshot,
  recordSnapshots,
  rememberRoute,
  samplesFromOffers,
} from '../store/history.js';
import { listWatches, watchDates, type Watch } from '../store/watches.js';
import { dueProbes, getProbe, pruneOrphanProbes, recordProbe, upsertProbe, type ProbeKey } from './probe-store.js';
import { createBudget, take, type BudgetState } from './budget.js';
import { diffSamples, type Change } from './diff.js';
import { matchWagons, type SeatMatch } from './seat-rules.js';

export interface EngineConfig {
  perHour: number;
  maxProbesPerCycle: number;
  searchTtlMs: number;
  seatCheckIntervalMs: number;
  dateSlack: number;
  maxSegmentOptions: number;
  priceDropMinKop: number;
  seatStep: boolean;
  maxSeatChecksPerCycle: number;
  maxEventsPerWatchPerCycle: number;
}

export const DEFAULT_CONFIG: EngineConfig = {
  perHour: 300,
  maxProbesPerCycle: 8,
  searchTtlMs: 45_000,
  seatCheckIntervalMs: 120_000,
  dateSlack: 1,
  maxSegmentOptions: 8,
  priceDropMinKop: 1_000,
  seatStep: true,
  maxSeatChecksPerCycle: 3,
  maxEventsPerWatchPerCycle: 5,
};

export interface EngineDeps {
  db: Db;
  client: UzClient;
  config?: Partial<EngineConfig>;
  now?: () => number;
  random?: () => number;
}

export interface CycleReport {
  planned: number;
  checked: number;
  changed: number;
  events: number;
  baselined: number;
  seatChecks: number;
  transportErrors: number;
  skippedGated: boolean;
  budgetLeft: number;
}

export function probeKeyOf(candidate: Candidate): string {
  return `${candidate.fromId}:${candidate.toId}:${candidate.date}:${candidate.withTransfers ? 1 : 0}`;
}

export class WatchEngine {
  private readonly config: EngineConfig;

  private readonly now: () => number;
  private readonly random: () => number;
  private budget: BudgetState;

  constructor(private readonly deps: EngineDeps) {
    this.config = { ...DEFAULT_CONFIG, ...deps.config };
    this.now = deps.now ?? (() => Date.now());
    this.random = deps.random ?? Math.random;
    this.budget = createBudget(this.config.perHour, this.now());
  }

  setProbeCap(cap: number): void {
    this.config.maxProbesPerCycle = Math.max(1, Math.round(cap));
  }

  get probeCap(): number {
    return this.config.maxProbesPerCycle;
  }

  planForWatches(): Map<string, { candidate: Candidate; watches: Watch[] }> {
    const plans = new Map<string, { candidate: Candidate; watches: Watch[] }>();
    for (const watch of listWatches(this.deps.db, 'active')) {
      const candidates = planCandidates(this.deps.db, {
        fromId: watch.fromId,
        toId: watch.toId,
        dates: watchDates(watch),
        dateSlack: this.config.dateSlack,
        maxSegmentOptions: this.config.maxSegmentOptions,
      });
      for (const candidate of candidates) {
        const key = probeKeyOf(candidate);
        const entry = plans.get(key);
        if (entry) {
          entry.watches.push(watch);
        } else {
          plans.set(key, { candidate, watches: [watch] });
        }
      }
    }
    return plans;
  }

  refreshProbes(plans: Map<string, { candidate: Candidate; watches: Watch[] }>): void {
    const now = this.now();
    for (const { candidate, watches } of plans.values()) {
      upsertProbe(this.deps.db, candidate, now, watches.some((w) => w.favorite));
    }
  }

  async runCycle(): Promise<CycleReport> {
    const plans = this.planForWatches();
    this.refreshProbes(plans);
    const plannedKeys = new Set(plans.keys());

    const now = this.now();
    pruneOrphanProbes(this.deps.db, plannedKeys, new Date(now).toISOString().slice(0, 10));
    const { state, granted } = take(this.budget, now, this.config.maxProbesPerCycle);
    this.budget = state;

    const report: CycleReport = {
      planned: plans.size,
      checked: 0,
      changed: 0,
      events: 0,
      baselined: 0,
      seatChecks: 0,
      transportErrors: 0,
      skippedGated: false,
      budgetLeft: Math.floor(state.tokens),
    };
    if (granted === 0) return report;

    for (const probe of dueProbes(this.deps.db, now, granted, plannedKeys)) {
      const key: ProbeKey = {
        fromId: probe.fromId,
        toId: probe.toId,
        date: probe.date,
        withTransfers: probe.withTransfers,
      };
      const plan = plans.get(`${key.fromId}:${key.toId}:${key.date}:${key.withTransfers ? 1 : 0}`);
      if (!plan) continue;

      const path = searchTripsPath({
        fromId: key.fromId,
        toId: key.toId,
        date: key.date,
        withTransfers: key.withTransfers,
      });

      let body: string;
      let hash: string;
      try {
        const res = await this.deps.client.get(path, { ttlMs: this.config.searchTtlMs });
        if (res.kind !== 'ok') continue;
        body = res.body;
        hash = res.hash;
      } catch (error) {
        if (error instanceof GateTrippedError) {
          report.skippedGated = true;
          break;
        }
        if (error instanceof TransportTimeoutError) {
          report.transportErrors += 1;
          continue;
        }
        throw error;
      }

      report.checked += 1;
      const takenAt = this.now();
      const before = getProbe(this.deps.db, key);
      const firstObservation = !before || before.lastHash === null;
      const outcome = recordProbe(this.deps.db, key, hash, takenAt, this.random);
      if (outcome.changed) report.changed += 1;

      const origin = plan.watches[0]!.fromId;
      const destination = plan.watches[0]!.toId;
      const refinedByKey = new Map<string, Refined>();
      const offers: Offer[] = [];
      for (const raw of offersFromSearch(parseSearch(JSON.parse(body)), plan.candidate)) {
        const refined = refineKind(this.deps.db, raw, origin, destination);
        if (!refined) continue;
        refinedByKey.set(`${raw.tripId}:${raw.classId}`, refined);
        offers.push({ ...raw, kind: refined.kind, why: refined.why || raw.why });
      }
      const samples = samplesFromOffers(offers);
      const previous = lastSamples(this.deps.db, key, takenAt);
      recordSnapshots(
        this.deps.db,
        takenAt,
        { fromId: key.fromId, toId: key.toId, date: key.date, source: plan.candidate.kind, why: plan.candidate.why },
        samples,
      );

      if (firstObservation) {
        report.baselined += 1;
        continue;
      }

      const changes = diffSamples(previous, samples, { priceDropMinKop: this.config.priceDropMinKop });
      if (changes.length === 0) continue;

      for (const watch of plan.watches) {
        const relevant = this.filterForWatch(watch, offers, changes).slice(
          0,
          this.config.maxEventsPerWatchPerCycle,
        );
        for (const change of relevant) {
          const refined = refinedByKey.get(`${change.tripId}:${change.classId}`);
          const journey = journeyTimes(
            this.deps.db,
            { trainNumber: change.trainNumber, fromId: key.fromId, departAt: change.departAt, arriveAt: change.arriveAt },
            refined?.boardId ?? key.fromId,
            refined?.alightId ?? key.toId,
          );
          const canCheckSeats =
            this.config.seatStep && report.seatChecks < this.config.maxSeatChecksPerCycle;
          const seats = canCheckSeats ? await this.seatDetails(watch, change, takenAt, report) : [];
          insertEvent(
            this.deps.db,
            watch.id,
            change.kind,
            {
              ...change,
              why: refined?.why || plan.candidate.why,
              candidateKind: refined?.kind ?? plan.candidate.kind,
              journeyDepartAt: journey.departAt,
              journeyArriveAt: journey.arriveAt,
              durationMin: journey.durationMin,
              fromId: key.fromId,
              toId: key.toId,
              date: key.date,
              seats: seats.map((match) => ({
                wagon: match.wagonNumber,
                key: match.wagonKey,
                lower: match.lower,
                upper: match.upper,
                priceKop: match.priceKop,
                seats: match.seats.slice(0, 12),
                adjacent: match.adjacentPairs.length,
              })),
            },
            takenAt,
          );
          report.events += 1;

          if (change.kind === 'appeared' && plan.candidate.kind !== 'direct') {
            rememberRoute(
              this.deps.db,
              watch.id,
              `${key.fromId}:${key.toId}:${plan.candidate.kind}`,
              {
                fromId: key.fromId,
                toId: key.toId,
                kind: plan.candidate.kind,
                why: plan.candidate.why,
                trainNumber: change.trainNumber,
              },
              takenAt,
            );
          }
        }
      }
    }

    report.budgetLeft = Math.floor(this.budget.tokens);
    return report;
  }

  private filterForWatch(watch: Watch, offers: Offer[], changes: Change[]): Change[] {
    const allowed = new Set(
      rankOffers(offers, {
        classes: watch.classes.length > 0 ? watch.classes : undefined,
        maxPriceKop: watch.maxPriceKop ?? undefined,
        minFreeSeats: watch.seatPrefs.minSeats,
      }).map((offer) => `${offer.tripId}:${offer.classId}`),
    );
    return changes.filter((change) => {
      if (watch.classes.length > 0 && !watch.classes.includes(change.classId)) return false;
      if (watch.maxPriceKop != null && change.priceKop > watch.maxPriceKop) return false;
      if (change.kind === 'gone') return true;
      return allowed.has(`${change.tripId}:${change.classId}`);
    });
  }

  private async seatDetails(
    watch: Watch,
    change: Change,
    now: number,
    report: CycleReport,
  ): Promise<SeatMatch[]> {
    if (change.kind === 'gone') return [];
    if (isTransferClass(change.classId)) return [];

    const row = this.deps.db
      .prepare('select max(taken_at) as takenAt from seat_snapshot where trip_id = ? and class_id = ?')
      .get(change.tripId, change.classId) as unknown as { takenAt: number | null } | undefined;
    const lastCheck = row?.takenAt ?? 0;
    if (now - lastCheck < this.config.seatCheckIntervalMs) return [];

    try {
      const res = await this.deps.client.get(wagonsByClassPath(change.tripId, change.classId), {
        ttlMs: this.config.seatCheckIntervalMs,
      });
      if (res.kind !== 'ok') return [];
      report.seatChecks += 1;
      const wagons = parseWagons(res.json());
      recordSeatSnapshot(this.deps.db, now, change.tripId, change.classId, wagons);
      return matchWagons(wagons, watch.seatPrefs);
    } catch (error) {
      if (error instanceof GateTrippedError) {
        report.skippedGated = true;
        return [];
      }
      if (error instanceof TransportTimeoutError) {
        report.transportErrors += 1;
        return [];
      }
      throw error;
    }
  }
}
