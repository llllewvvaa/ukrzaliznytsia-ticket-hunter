import { browser } from 'wxt/browser';
import type { HuntJob } from './models';

// Fair-play floor / ceiling for the monitor poll interval.
export const MONITOR_MIN_MS = 5_000;
export const MONITOR_MAX_MS = 30_000;
export const MONITOR_DEFAULT_MS = 15_000;

export const BACKOFF_CAP_MS = 60_000;
// Fair-play minimum pause after a 429 before the next attempt.
export const RATE_LIMIT_MIN_PAUSE_MS = 30_000;

export const SPRINT_MIN_MS = 200;
export const SPRINT_MAX_MS = 500;
export const SPRINT_DEFAULT_MS = 300;

// Wake the SW this long before `startAt` to warm up the connection/auth.
export const SPRINT_WARMUP_LEAD_MS = 10_000;
export const SPRINT_WINDOW_MS = 5 * 60_000;

const TICK_PREFIX = 'uz-hunt:';
const WARMUP_PREFIX = 'uz-warmup:';

export function tickAlarmName(jobId: string): string {
  return `${TICK_PREFIX}${jobId}`;
}

export function warmupAlarmName(jobId: string): string {
  return `${WARMUP_PREFIX}${jobId}`;
}

export interface ParsedAlarm {
  kind: 'tick' | 'warmup';
  jobId: string;
}

export function parseAlarmName(name: string): ParsedAlarm | null {
  if (name.startsWith(TICK_PREFIX)) {
    return { kind: 'tick', jobId: name.slice(TICK_PREFIX.length) };
  }
  if (name.startsWith(WARMUP_PREFIX)) {
    return { kind: 'warmup', jobId: name.slice(WARMUP_PREFIX.length) };
  }
  return null;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function clampMonitorInterval(ms: number | undefined): number {
  return clamp(ms ?? MONITOR_DEFAULT_MS, MONITOR_MIN_MS, MONITOR_MAX_MS);
}

export function clampSprintInterval(ms: number | undefined): number {
  return clamp(ms ?? SPRINT_DEFAULT_MS, SPRINT_MIN_MS, SPRINT_MAX_MS);
}

export function nextBackoffMs(currentMs: number | undefined): number {
  const base = currentMs ?? MONITOR_DEFAULT_MS;
  return clamp(base * 2, MONITOR_MIN_MS, BACKOFF_CAP_MS);
}

export function rateLimitPauseUntil(
  job: Pick<HuntJob, 'pollIntervalMs'>,
  retryAfterSec: number | undefined,
  now = Date.now(),
): { pollIntervalMs: number; pausedUntil: number } {
  const pollIntervalMs = nextBackoffMs(job.pollIntervalMs);
  const wait = Math.max(
    pollIntervalMs,
    (retryAfterSec ?? 0) * 1_000,
    RATE_LIMIT_MIN_PAUSE_MS,
  );
  return { pollIntervalMs, pausedUntil: now + wait };
}

export function monitorDelayMs(job: HuntJob, now = Date.now()): number {
  if (job.pausedUntil && job.pausedUntil > now) {
    return job.pausedUntil - now;
  }
  return clampMonitorInterval(job.pollIntervalMs);
}

export function warmupAtMs(job: HuntJob): number | null {
  if (job.startAt == null) return null;
  return job.startAt - SPRINT_WARMUP_LEAD_MS;
}

export function inSprintWindow(job: HuntJob, now = Date.now()): boolean {
  if (job.startAt == null) return false;
  return now >= job.startAt && now <= job.startAt + SPRINT_WINDOW_MS;
}

export async function scheduleMonitorAlarm(
  job: HuntJob,
  now = Date.now(),
): Promise<void> {
  await browser.alarms.create(tickAlarmName(job.id), {
    when: now + monitorDelayMs(job, now),
  });
}

export async function scheduleSprintWarmup(
  job: HuntJob,
  now = Date.now(),
): Promise<void> {
  const at = warmupAtMs(job);
  if (at == null) return;
  await browser.alarms.create(warmupAlarmName(job.id), {
    when: Math.max(at, now + 100),
  });
}

export async function clearJobAlarms(jobId: string): Promise<void> {
  await browser.alarms.clear(tickAlarmName(jobId));
  await browser.alarms.clear(warmupAlarmName(jobId));
}
