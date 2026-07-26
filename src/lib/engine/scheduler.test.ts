import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import {
  clamp,
  clampMonitorInterval,
  clampSprintInterval,
  nextBackoffMs,
  rateLimitPauseUntil,
  monitorDelayMs,
  warmupAtMs,
  inSprintWindow,
  parseAlarmName,
  tickAlarmName,
  warmupAlarmName,
  scheduleMonitorAlarm,
  scheduleSprintWarmup,
  clearJobAlarms,
  MONITOR_MIN_MS,
  MONITOR_MAX_MS,
  MONITOR_DEFAULT_MS,
  BACKOFF_CAP_MS,
  RATE_LIMIT_MIN_PAUSE_MS,
  SPRINT_MIN_MS,
  SPRINT_MAX_MS,
  SPRINT_WARMUP_LEAD_MS,
  SPRINT_WINDOW_MS,
} from './scheduler';
import type { HuntJob } from '@/lib/models';

function makeJob(over: Partial<HuntJob> = {}): HuntJob {
  const now = Date.now();
  return {
    id: over.id ?? 'job-1',
    name: 'Kyiv → Lviv',
    state: 'hunting',
    mode: 'monitor',
    from: { id: 2200001, name: 'Київ-Пас' },
    to: { id: 2218218, name: 'Татарів' },
    date: '2026-07-19',
    preferredTrains: [],
    coachTypes: [],
    passengerIds: [1],
    bedding: true,
    attempts: 0,
    createdAt: now,
    updatedAt: now,
    ...over,
  };
}

describe('scheduler: pure helpers', () => {
  it('clamps within bounds', () => {
    expect(clamp(5, 1, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
  });

  it('clampMonitorInterval respects floor/ceiling and default', () => {
    expect(clampMonitorInterval(undefined)).toBe(MONITOR_DEFAULT_MS);
    expect(clampMonitorInterval(1000)).toBe(MONITOR_MIN_MS);
    expect(clampMonitorInterval(999_999)).toBe(MONITOR_MAX_MS);
    expect(clampMonitorInterval(12_000)).toBe(12_000);
  });

  it('clampSprintInterval respects 200–500 ms', () => {
    expect(clampSprintInterval(50)).toBe(SPRINT_MIN_MS);
    expect(clampSprintInterval(9_000)).toBe(SPRINT_MAX_MS);
    expect(clampSprintInterval(350)).toBe(350);
  });

  it('nextBackoffMs doubles and caps', () => {
    expect(nextBackoffMs(undefined)).toBe(MONITOR_MAX_MS); // 15000*2 = 30000 ≤ cap
    expect(nextBackoffMs(5_000)).toBe(10_000);
    expect(nextBackoffMs(40_000)).toBe(BACKOFF_CAP_MS);
  });

  it('rateLimitPauseUntil honors the largest of backoff/retry-after/min', () => {
    const now = 1_000_000;
    // doubled interval (30s) vs min pause (30s) → 30s
    const a = rateLimitPauseUntil({ pollIntervalMs: 15_000 }, undefined, now);
    expect(a.pollIntervalMs).toBe(30_000);
    expect(a.pausedUntil).toBe(now + Math.max(30_000, RATE_LIMIT_MIN_PAUSE_MS));

    // server retry-after dominates
    const b = rateLimitPauseUntil({ pollIntervalMs: 5_000 }, 90, now);
    expect(b.pausedUntil).toBe(now + 90_000);
  });

  it('monitorDelayMs honors an active backoff window', () => {
    const now = 1_000_000;
    expect(monitorDelayMs(makeJob({ pollIntervalMs: 8_000 }), now)).toBe(8_000);
    expect(monitorDelayMs(makeJob({ pollIntervalMs: 8_000, pausedUntil: now + 25_000 }), now)).toBe(
      25_000,
    );
    // expired backoff → normal interval
    expect(monitorDelayMs(makeJob({ pollIntervalMs: 8_000, pausedUntil: now - 1 }), now)).toBe(
      8_000,
    );
  });

  it('warmupAtMs is startAt minus the lead, or null', () => {
    expect(warmupAtMs(makeJob({ startAt: undefined }))).toBeNull();
    expect(warmupAtMs(makeJob({ startAt: 5_000_000 }))).toBe(5_000_000 - SPRINT_WARMUP_LEAD_MS);
  });

  it('inSprintWindow brackets [startAt, startAt+window]', () => {
    const startAt = 2_000_000;
    expect(inSprintWindow(makeJob({ startAt }), startAt - 1)).toBe(false);
    expect(inSprintWindow(makeJob({ startAt }), startAt)).toBe(true);
    expect(inSprintWindow(makeJob({ startAt }), startAt + SPRINT_WINDOW_MS)).toBe(true);
    expect(inSprintWindow(makeJob({ startAt }), startAt + SPRINT_WINDOW_MS + 1)).toBe(false);
    expect(inSprintWindow(makeJob({ startAt: undefined }))).toBe(false);
  });

  it('alarm names round-trip through parseAlarmName', () => {
    expect(parseAlarmName(tickAlarmName('abc'))).toEqual({ kind: 'tick', jobId: 'abc' });
    expect(parseAlarmName(warmupAlarmName('xyz'))).toEqual({ kind: 'warmup', jobId: 'xyz' });
    expect(parseAlarmName('something-else')).toBeNull();
  });
});

describe('scheduler: alarm wiring', () => {
  beforeEach(() => {
    fakeBrowser.reset();
  });

  it('scheduleMonitorAlarm creates a tick alarm and clearJobAlarms removes it', async () => {
    const job = makeJob({ id: 'j2', pollIntervalMs: 10_000 });
    await scheduleMonitorAlarm(job, 1_000_000);

    const alarm = await fakeBrowser.alarms.get(tickAlarmName('j2'));
    expect(alarm?.scheduledTime).toBe(1_010_000);

    await clearJobAlarms('j2');
    expect(await fakeBrowser.alarms.get(tickAlarmName('j2'))).toBeFalsy();
  });

  it('scheduleSprintWarmup arms a warmup alarm before startAt', async () => {
    const startAt = 5_000_000;
    await scheduleSprintWarmup(makeJob({ id: 'j3', mode: 'scheduled', startAt }), 1_000_000);

    const alarm = await fakeBrowser.alarms.get(warmupAlarmName('j3'));
    expect(alarm?.scheduledTime).toBe(startAt - SPRINT_WARMUP_LEAD_MS);
  });

  it('scheduleSprintWarmup is a no-op without startAt', async () => {
    await scheduleSprintWarmup(makeJob({ id: 'j4', mode: 'scheduled' }));
    expect(await fakeBrowser.alarms.get(warmupAlarmName('j4'))).toBeFalsy();
  });
});
