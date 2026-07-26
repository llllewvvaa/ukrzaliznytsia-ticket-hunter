import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { browser } from 'wxt/browser';
import { saveJob, newJobId } from '@/lib/store';
import { setSession } from '@/lib/api/auth';
import { applyActionState } from './action-icon';
import { isIconAlarm, refreshActionIcon } from './icon-sync';
import type { HuntJob } from '@/lib/models';

vi.mock('./action-icon', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./action-icon')>();
  return { ...actual, applyActionState: vi.fn() };
});

const applyMock = vi.mocked(applyActionState);

function makeJob(over: Partial<HuntJob> = {}): HuntJob {
  const now = Date.now();
  return {
    id: over.id ?? newJobId(),
    name: 'Kyiv → Lviv',
    state: 'hunting',
    mode: 'monitor',
    from: { id: 2200001, name: 'Київ-Пас' },
    to: { id: 2218218, name: 'Татарів' },
    date: '2026-07-19',
    preferredTrains: [],
    coachTypes: [],
    passengerIds: [2000001],
    bedding: true,
    attempts: 0,
    createdAt: now,
    updatedAt: now,
    ...over,
  };
}

async function seedSession(): Promise<void> {
  await setSession({ authToken: 't', sessionId: 's', userId: 1 });
}

const lastState = (): string => applyMock.mock.calls.at(-1)?.[0] as string;

beforeEach(() => {
  fakeBrowser.reset();
  applyMock.mockClear();
});

describe('refreshActionIcon', () => {
  it('green when session active and no jobs', async () => {
    await seedSession();
    await refreshActionIcon();
    expect(lastState()).toBe('active');
  });

  it('gray when no session and no jobs', async () => {
    await refreshActionIcon();
    expect(lastState()).toBe('off');
  });

  it('counts scheduled/hunting/reserving jobs as hunts', async () => {
    await seedSession();
    await saveJob(makeJob({ state: 'scheduled' }));
    await saveJob(makeJob({ state: 'hunting' }));
    await saveJob(makeJob({ state: 'paused' })); // not active
    await refreshActionIcon();
    expect(lastState()).toBe('hunts');
    expect(applyMock.mock.calls.at(-1)?.[1]).toContain('2');
  });

  it('prioritizes a live reservation and arms an expiry alarm', async () => {
    await seedSession();
    const until = Date.now() + 10 * 60_000;
    await saveJob(makeJob({ state: 'hunting' }));
    await saveJob(makeJob({ state: 'reserved', reservedUntil: until }));
    await refreshActionIcon();
    expect(lastState()).toBe('reserved');

    const alarm = await browser.alarms.get('icon:reserved-expiry');
    expect(alarm?.scheduledTime).toBe(until + 5_000);
  });

  it('ignores an expired reservation hold', async () => {
    await seedSession();
    await saveJob(makeJob({ state: 'reserved', reservedUntil: Date.now() - 1_000 }));
    await refreshActionIcon();
    expect(lastState()).toBe('active');
    expect(await browser.alarms.get('icon:reserved-expiry')).toBeUndefined();
  });
});

describe('isIconAlarm', () => {
  it('matches only the expiry alarm', () => {
    expect(isIconAlarm('icon:reserved-expiry')).toBe(true);
    expect(isIconAlarm('tick:abc')).toBe(false);
  });
});
