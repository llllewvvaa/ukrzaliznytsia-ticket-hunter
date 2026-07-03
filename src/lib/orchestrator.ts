import { browser } from 'wxt/browser';
import {
  ACTIVE_STATES,
  type HuntJob,
  type PauseReason,
  type Trip,
  type WagonClassSummary,
} from './models';
import { deleteJob, getJob, listJobs, patchJob } from './store';
import { log } from './logger';
import { getAuthHeaders } from './auth';
import type { JobControlMessage } from './messages';
import {
  AuthError,
  NotDiscoveredError,
  RateLimitError,
  getProfile,
  registerMonitor,
  searchTrips,
} from './uz-api';
import {
  clampSprintInterval,
  clearJobAlarms,
  parseAlarmName,
  rateLimitPauseUntil,
  scheduleMonitorAlarm,
  scheduleSprintWarmup,
  tickAlarmName,
  MONITOR_DEFAULT_MS,
  SPRINT_WINDOW_MS,
} from './scheduler';

export interface TripMatch {
  trip: Trip;
  wagonClass: WagonClassSummary;
}

// Numeric core for cross-source matching: static timetable "66" must match booking.uz "066Ш".
export function normalizeTrainNumber(n: string): string {
  const digits = /\d+/.exec(n)?.[0];
  return digits ? String(Number(digits)) : n.trim().toUpperCase();
}

export function matchTrip(trips: Trip[], job: HuntJob): TripMatch | null {
  const needed = Math.max(1, job.passengerIds.length);
  const wanted = job.preferredTrains.map(normalizeTrainNumber);
  for (const trip of trips) {
    if (wanted.length > 0 && !wanted.includes(normalizeTrainNumber(trip.train.number))) {
      continue;
    }
    const classes = trip.train.wagon_classes ?? [];
    const ordered: WagonClassSummary[] =
      job.coachTypes.length > 0
        ? job.coachTypes
            .map((c) => classes.find((w) => w.id === c))
            .filter((w): w is WagonClassSummary => w != null)
        : classes;
    const wagonClass = ordered.find((w) => w.free_seats >= needed);
    if (wagonClass) return { trip, wagonClass };
  }
  return null;
}

let reserveInFlight: string | null = null;

export function reserveInFlightJob(): string | null {
  return reserveInFlight;
}

export function acquireReserveLock(jobId: string): boolean {
  if (reserveInFlight && reserveInFlight !== jobId) return false;
  reserveInFlight = jobId;
  return true;
}

export function releaseReserveLock(jobId: string): void {
  if (reserveInFlight === jobId) reserveInFlight = null;
}

export interface ReserveDispatch {
  job: HuntJob;
  match: TripMatch;
}

export type ReserveDispatcher = (d: ReserveDispatch) => Promise<void> | void;

async function defaultReserveDispatcher({ job }: ReserveDispatch): Promise<void> {
  await log({
    jobId: job.id,
    endpoint: 'reserveNow',
    outcome: 'info',
    detail: 'reserve executor not wired yet (Step 5)',
  });
  releaseReserveLock(job.id);
  await patchJob(job.id, { state: 'hunting' });
}

let reserveDispatcher: ReserveDispatcher = defaultReserveDispatcher;

export function setReserveDispatcher(fn: ReserveDispatcher): void {
  reserveDispatcher = fn;
}

const sprintTimers = new Map<string, ReturnType<typeof setTimeout>>();

async function haltJob(jobId: string): Promise<void> {
  await clearJobAlarms(jobId);
  releaseReserveLock(jobId);
  const timer = sprintTimers.get(jobId);
  if (timer) {
    clearTimeout(timer);
    sprintTimers.delete(jobId);
  }
}

// Test-only: reset module-level runtime state.
export function resetOrchestratorState(): void {
  reserveInFlight = null;
  reserveDispatcher = defaultReserveDispatcher;
  for (const t of sprintTimers.values()) clearTimeout(t);
  sprintTimers.clear();
}

export async function huntOnce(jobId: string): Promise<void> {
  const job = await getJob(jobId);
  if (!job || job.state !== 'hunting') return;

  // One global reserve at a time; let the other job finish first.
  if (reserveInFlight && reserveInFlight !== job.id) {
    await log({
      jobId: job.id,
      endpoint: 'tick',
      outcome: 'info',
      detail: 'reserve in flight elsewhere; skipping tick',
    });
    return;
  }

  const headers = await getAuthHeaders();
  if (!headers) {
    await pause(job, 'not_authenticated', 'log in at booking.uz');
    return;
  }

  const attempts = job.attempts + 1;
  try {
    const trips = await searchTrips({
      fromId: job.from.id,
      toId: job.to.id,
      date: job.date,
    });
    const match = matchTrip(trips, job);
    await patchJob(job.id, {
      attempts,
      lastAttemptAt: Date.now(),
      pausedUntil: undefined,
    });

    if (match) {
      await beginReserve({ ...job, attempts }, match);
      return;
    }

    await log({
      jobId: job.id,
      endpoint: 'GET /api/v3/trips',
      outcome: 'no_match',
      detail: `${trips.length} trips, none matched`,
    });
    await maybeExhaust(job.id, attempts, job.maxAttempts, job.mode);
  } catch (err) {
    await handleHuntError({ ...job, attempts }, err);
  }
}

async function beginReserve(job: HuntJob, match: TripMatch): Promise<void> {
  acquireReserveLock(job.id);
  // Stop the monitor alarm while reserving; the reserve flow drives itself.
  await browser.alarms.clear(tickAlarmName(job.id));
  await patchJob(job.id, { state: 'reserving' });
  await log({
    jobId: job.id,
    endpoint: 'GET /api/v3/trips',
    outcome: 'matched',
    detail: `train ${match.trip.train.number} ${match.wagonClass.id} free=${match.wagonClass.free_seats}`,
  });
  await reserveDispatcher({ job: { ...job, state: 'reserving' }, match });
}

async function handleHuntError(job: HuntJob, err: unknown): Promise<void> {
  if (err instanceof AuthError) {
    await pause(job, 'not_authenticated', 'session expired');
    return;
  }
  if (err instanceof RateLimitError) {
    const { pollIntervalMs, pausedUntil } = rateLimitPauseUntil(
      job,
      err.retryAfterSec,
    );
    await patchJob(job.id, { pollIntervalMs, pausedUntil });
    await log({
      jobId: job.id,
      endpoint: 'GET /api/v3/trips',
      httpStatus: 429,
      outcome: 'rate_limited',
      detail: `backoff ~${Math.round((pausedUntil - Date.now()) / 1000)}s`,
    });
    // rearm() re-arms honoring pausedUntil.
    return;
  }
  if (err instanceof NotDiscoveredError) {
    await clearJobAlarms(job.id);
    await patchJob(job.id, { state: 'failed', lastError: err.message });
    await log({
      jobId: job.id,
      endpoint: 'GET /api/v3/trips',
      outcome: 'error',
      detail: err.message,
    });
    return;
  }
  const detail = err instanceof Error ? err.message : String(err);
  await log({ jobId: job.id, endpoint: 'tick', outcome: 'error', detail });
  await maybeExhaust(job.id, job.attempts, job.maxAttempts, job.mode);
}

async function maybeExhaust(
  jobId: string,
  attempts: number,
  maxAttempts: number | undefined,
  mode: HuntJob['mode'],
): Promise<void> {
  // The attempt cap applies only to monitor polling; sprints are bounded by their window.
  if (mode !== 'monitor' || maxAttempts == null || attempts < maxAttempts) return;
  await clearJobAlarms(jobId);
  await patchJob(jobId, { state: 'failed', lastError: 'max_attempts' });
  await log({
    jobId,
    endpoint: 'tick',
    outcome: 'error',
    detail: `max attempts (${maxAttempts}) reached`,
  });
}

async function pause(
  job: HuntJob,
  reason: PauseReason,
  detail?: string,
): Promise<void> {
  await clearJobAlarms(job.id);
  releaseReserveLock(job.id);
  await patchJob(job.id, {
    state: 'paused',
    pauseReason: reason,
    ...(detail ? { lastError: detail } : {}),
  });
  await log({
    jobId: job.id,
    endpoint: 'tick',
    outcome: reason === 'not_authenticated' ? 'auth_missing' : 'paused',
    detail: detail ?? reason,
  });
}

export async function handleAlarm(name: string): Promise<void> {
  const parsed = parseAlarmName(name);
  if (!parsed) return;
  if (parsed.kind === 'warmup') {
    await onWarmup(parsed.jobId);
  } else {
    await onTick(parsed.jobId);
  }
}

async function onTick(jobId: string): Promise<void> {
  await huntOnce(jobId);
  await rearm(jobId);
}

async function rearm(jobId: string): Promise<void> {
  const job = await getJob(jobId);
  if (!job || job.state !== 'hunting') {
    await browser.alarms.clear(tickAlarmName(jobId));
    return;
  }
  if (job.mode === 'monitor') await scheduleMonitorAlarm(job);
}

async function onWarmup(jobId: string): Promise<void> {
  const job = await getJob(jobId);
  if (!job || job.state !== 'scheduled') return;
  try {
    await getProfile();
    await log({
      jobId,
      endpoint: 'GET /api/v2/profile',
      outcome: 'info',
      detail: 'warmup ok',
    });
  } catch {
    // warmup failures are non-fatal; the sprint surfaces real errors.
  }
  await patchJob(jobId, { state: 'hunting' });
  void runSprint(jobId);
}

export async function runSprint(jobId: string): Promise<void> {
  const job = await getJob(jobId);
  if (!job) return;
  const interval = clampSprintInterval(job.sprintIntervalMs);
  const deadline = (job.startAt ?? Date.now()) + SPRINT_WINDOW_MS;

  const loop = async (): Promise<void> => {
    sprintTimers.delete(jobId);
    const current = await getJob(jobId);
    if (!current || current.state !== 'hunting') return;

    if (Date.now() > deadline) {
      // Sprint window elapsed: drop to monitor cadence instead of failing (seats may free up later).
      const fallback: HuntJob = { ...current, mode: 'monitor', pollIntervalMs: MONITOR_DEFAULT_MS };
      await patchJob(jobId, { mode: 'monitor', pollIntervalMs: MONITOR_DEFAULT_MS });
      await scheduleMonitorAlarm(fallback);
      await log({
        jobId,
        endpoint: 'sprint',
        outcome: 'info',
        detail: 'sprint window elapsed → switched to monitoring',
      });
      return;
    }

    await huntOnce(jobId);

    const after = await getJob(jobId);
    if (after && after.state === 'hunting') {
      sprintTimers.set(jobId, setTimeout(() => void loop(), interval));
    }
  };

  await loop();
}

async function startNative(job: HuntJob): Promise<void> {
  try {
    await registerMonitor({
      tripId: 0,
      passengerIds: job.passengerIds,
      coachTypes: job.coachTypes.map(String),
    });
    await patchJob(job.id, { state: 'hunting' });
    await log({
      jobId: job.id,
      endpoint: 'registerMonitor',
      outcome: 'info',
      detail: 'native monitor registered',
    });
  } catch (err) {
    const detail =
      err instanceof NotDiscoveredError
        ? 'native monitoring not available'
        : err instanceof Error
          ? err.message
          : String(err);
    await patchJob(job.id, { state: 'failed', lastError: detail });
    await log({
      jobId: job.id,
      endpoint: 'registerMonitor',
      outcome: 'error',
      detail,
    });
  }
}

export async function startJob(job: HuntJob): Promise<void> {
  if (job.mode === 'native') {
    await startNative(job);
    return;
  }

  if (job.mode === 'scheduled' && job.startAt != null && job.startAt > Date.now()) {
    await patchJob(job.id, {
      state: 'scheduled',
      pauseReason: undefined,
      pausedUntil: undefined,
    });
    await scheduleSprintWarmup(job);
    await log({
      jobId: job.id,
      endpoint: 'schedule',
      outcome: 'info',
      detail: `sprint armed for ${new Date(job.startAt).toISOString()}`,
    });
    return;
  }

  // monitor — or a scheduled job whose startAt already passed → hunt now.
  const hunting: HuntJob = {
    ...job,
    state: 'hunting',
    pauseReason: undefined,
    pausedUntil: undefined,
  };
  await patchJob(job.id, {
    state: 'hunting',
    pauseReason: undefined,
    pausedUntil: undefined,
  });
  await scheduleMonitorAlarm(hunting);
  await log({
    jobId: job.id,
    endpoint: 'schedule',
    outcome: 'info',
    detail: 'monitoring started',
  });
  // First search runs now so user restarts act immediately; deliberately no re-arm, so it can't race a pause/cancel.
  void huntOnce(job.id).catch(() => {});
}

export async function pauseJob(jobId: string): Promise<void> {
  const job = await getJob(jobId);
  if (!job) return;
  await haltJob(jobId);
  await patchJob(jobId, { state: 'paused', pauseReason: 'user' });
  await log({ jobId, endpoint: 'control', outcome: 'paused', detail: 'paused by user' });
}

export async function resumeJob(jobId: string): Promise<void> {
  const job = await getJob(jobId);
  if (!job) return;
  await log({ jobId, endpoint: 'control', outcome: 'resumed' });
  await startJob({ ...job, pauseReason: undefined, pausedUntil: undefined });
}

export async function cancelJob(jobId: string): Promise<void> {
  await haltJob(jobId);
  await patchJob(jobId, { state: 'cancelled' });
  await log({ jobId, endpoint: 'control', outcome: 'info', detail: 'cancelled' });
}

export async function removeJob(jobId: string): Promise<void> {
  await haltJob(jobId);
  await deleteJob(jobId);
}

export async function restoreActiveJobs(): Promise<void> {
  const jobs = await listJobs();
  for (const job of jobs) {
    if (!ACTIVE_STATES.includes(job.state)) continue;
    if (job.mode === 'scheduled' && job.state === 'scheduled') {
      await scheduleSprintWarmup(job);
    } else {
      // hunting or reserving (SW died mid-reserve): resume monitoring.
      await scheduleMonitorAlarm(job);
    }
  }
}

export async function handleControlMessage(msg: JobControlMessage): Promise<void> {
  switch (msg.action) {
    case 'start': {
      const job = await getJob(msg.jobId);
      if (job) await startJob(job);
      break;
    }
    case 'pause':
      await pauseJob(msg.jobId);
      break;
    case 'resume':
      await resumeJob(msg.jobId);
      break;
    case 'cancel':
      await cancelJob(msg.jobId);
      break;
    case 'delete':
      await removeJob(msg.jobId);
      break;
  }
}
