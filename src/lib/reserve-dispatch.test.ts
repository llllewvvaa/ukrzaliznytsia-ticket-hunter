import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import type { ReserveOutcome, HuntJob, Trip } from './models';
import type { TripMatch } from './orchestrator';

// Scripted RPC outcome + progress, shared between the mock and the tests.
const h = vi.hoisted(() => ({
  outcome: { status: 'reserve_fail' } as ReserveOutcome,
  progress: [] as ReserveOutcome[],
}));

vi.mock('./tab-manager', () => ({
  BOOKING_URL: 'https://booking.uz.gov.ua/',
  ensureBookingTab: vi.fn(async () => 123),
  focusBookingTab: vi.fn(async () => {}),
  findBookingTab: vi.fn(async () => ({ id: 123 })),
}));

vi.mock('./bridge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./bridge')>();
  return {
    ...actual,
    connectToTab: vi.fn(() => {
      let listener: ((p: unknown) => void) | undefined;
      return {
        call: vi.fn(async () => {
          for (const e of h.progress) listener?.(e);
          return h.outcome;
        }),
        on: vi.fn((_channel: string, cb: (p: unknown) => void) => {
          listener = cb;
          return () => {};
        }),
        disconnect: vi.fn(),
      };
    }),
  };
});

import { dispatchReserve } from './reserve-dispatch';
import { focusBookingTab } from './tab-manager';
import { resetOrchestratorState } from './orchestrator';
import { getJob, saveJob } from './store';
import { tickAlarmName } from './scheduler';

const trip = { id: 3000001, train: { number: '057К' } } as unknown as Trip;
const match: TripMatch = {
  trip,
  wagonClass: { id: 'П', name: 'Плацкарт', free_seats: 9, price: 1000, amenities: [] },
};

function makeJob(over: Partial<HuntJob> = {}): HuntJob {
  return {
    id: 'rd1',
    name: 'Kyiv → Lviv',
    state: 'reserving',
    mode: 'monitor',
    from: { id: 1, name: 'A' },
    to: { id: 2, name: 'B' },
    date: '2026-07-19',
    preferredTrains: [],
    coachTypes: [],
    passengerIds: [1],
    bedding: true,
    attempts: 0,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

beforeEach(() => {
  fakeBrowser.reset();
  resetOrchestratorState();
  h.progress = [];
  h.outcome = { status: 'reserve_fail' };
});

describe('dispatchReserve', () => {
  it('reserve_ok → reserved + notification + opens the /payment checkout', async () => {
    const job = makeJob();
    await saveJob(job);
    h.progress = [
      { status: 'order_enqueued', cartId: 999 },
      { status: 'cart_pending', cartId: 999, retryInSec: 6 },
    ];
    // The real cart-ready response carries no payment_url.
    h.outcome = { status: 'reserve_ok', cartId: 999 };
    const notif = vi.spyOn(fakeBrowser.notifications, 'create');
    const tabs = vi.spyOn(fakeBrowser.tabs, 'create');

    await dispatchReserve({ job, match });

    const saved = await getJob('rd1');
    expect(saved?.state).toBe('reserved');
    expect(saved?.cartId).toBe(999);
    expect(notif).toHaveBeenCalledOnce();
    // No payment_url → fall back to the real /payment checkout (not /cart/, which 404s).
    expect(tabs).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://booking.uz.gov.ua/payment', active: true }),
    );
  });

  it('captcha → paused(captcha) and focuses the booking tab', async () => {
    await saveJob(makeJob({ id: 'rd2' }));
    h.outcome = { status: 'captcha', detail: 'challenge' };

    await dispatchReserve({ job: makeJob({ id: 'rd2' }), match });

    const saved = await getJob('rd2');
    expect(saved?.state).toBe('paused');
    expect(saved?.pauseReason).toBe('captcha');
    expect(vi.mocked(focusBookingTab)).toHaveBeenCalledWith(123);
  });

  it('rate_limited → back to hunting with backoff + re-armed alarm', async () => {
    await saveJob(makeJob({ id: 'rd3', pollIntervalMs: 15_000 }));
    h.outcome = { status: 'rate_limited', retryInSec: 30, cartId: 5 };

    const before = Date.now();
    await dispatchReserve({ job: makeJob({ id: 'rd3', pollIntervalMs: 15_000 }), match });

    const saved = await getJob('rd3');
    expect(saved?.state).toBe('hunting');
    expect(saved?.pollIntervalMs).toBe(30_000);
    expect(saved?.pausedUntil ?? 0).toBeGreaterThanOrEqual(before + 30_000);
    expect(await fakeBrowser.alarms.get(tickAlarmName('rd3'))).toBeTruthy();
  });

  it('reserve_fail → back to hunting and reschedules', async () => {
    await saveJob(makeJob({ id: 'rd4' }));
    h.outcome = { status: 'reserve_fail', detail: 'no_seats' };

    await dispatchReserve({ job: makeJob({ id: 'rd4' }), match });

    const saved = await getJob('rd4');
    expect(saved?.state).toBe('hunting');
    expect(saved?.lastError).toBe('no_seats');
    expect(await fakeBrowser.alarms.get(tickAlarmName('rd4'))).toBeTruthy();
  });
});
