import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing';

// Auth + network are mocked; storage/alarms use the in-memory fakeBrowser.
vi.mock('./auth', () => ({ getAuthHeaders: vi.fn() }));
vi.mock('./uz-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./uz-api')>();
  return {
    ...actual,
    searchTrips: vi.fn(),
    getProfile: vi.fn(),
    registerMonitor: vi.fn(),
  };
});

import searchFix from '../../fixtures/search.json';
import { getAuthHeaders } from './auth';
import { searchTrips, parseSearchTrips, RateLimitError, AuthError } from './uz-api';
import {
  matchTrip,
  huntOnce,
  startJob,
  pauseJob,
  cancelJob,
  removeJob,
  handleAlarm,
  resetOrchestratorState,
  setReserveDispatcher,
  reserveInFlightJob,
  type ReserveDispatch,
} from './orchestrator';
import { getJob, saveJob } from './store';
import { tickAlarmName, warmupAlarmName } from './scheduler';
import type { HuntJob, Trip, UzAuthHeaders } from './models';

const FAKE_HEADERS: UzAuthHeaders = {
  Authorization: 'Bearer x.y.z',
  'x-session-id': '00000000-0000-4000-8000-000000000000',
  'x-user-agent': 'UZ/2 Web/1 User/1000001',
  'x-client-locale': 'uk',
  accept: 'application/json',
};

function makeTrip(
  number: string,
  classes: Array<{ id: string; free: number }>,
): Trip {
  return {
    id: 3000001,
    depart_at: 0,
    arrive_at: 0,
    station_from: { id: 2200001, name: 'A' },
    station_to: { id: 2218218, name: 'B' },
    train: {
      id: 1,
      number,
      type: 0,
      station_from: 'A',
      station_to: 'B',
      wagon_classes: classes.map((c) => ({
        id: c.id,
        name: c.id,
        free_seats: c.free,
        price: 1000,
        amenities: [],
      })),
    },
    route_points: [],
    monitoring: { allowed: true, auto_purchase: true },
    seat_hold_enabled: true,
    max_passengers_count: 4,
  };
}

function makeJob(over: Partial<HuntJob> = {}): HuntJob {
  const now = Date.now();
  return {
    id: over.id ?? 'job-1',
    name: 'Kyiv → Lviv',
    state: 'hunting',
    mode: 'monitor',
    from: { id: 2200001, name: 'A' },
    to: { id: 2218218, name: 'B' },
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

beforeEach(() => {
  fakeBrowser.reset();
  resetOrchestratorState();
  vi.mocked(getAuthHeaders).mockResolvedValue(FAKE_HEADERS);
  vi.mocked(searchTrips).mockReset();
});

describe('matchTrip', () => {
  it('returns null when nothing is offered', () => {
    expect(matchTrip([], makeJob())).toBeNull();
  });

  it('requires enough free seats for all passengers', () => {
    const job = makeJob({ passengerIds: [1, 2] });
    expect(matchTrip([makeTrip('057К', [{ id: 'П', free: 1 }])], job)).toBeNull();
    const m = matchTrip([makeTrip('057К', [{ id: 'П', free: 2 }])], job);
    expect(m?.wagonClass.id).toBe('П');
  });

  it('filters by preferred train numbers', () => {
    const job = makeJob({ preferredTrains: ['091К'] });
    expect(matchTrip([makeTrip('057К', [{ id: 'П', free: 9 }])], job)).toBeNull();
    expect(
      matchTrip([makeTrip('091К', [{ id: 'П', free: 9 }])], job)?.trip.train.number,
    ).toBe('091К');
  });

  it('matches a timetable number (no zero-pad/letter) against booking.uz format', () => {
    // Timetable gives "66"; booking.uz search returns "066Ш" — must still match.
    const job = makeJob({ preferredTrains: ['66'] });
    expect(
      matchTrip([makeTrip('066Ш', [{ id: 'К', free: 4 }])], job)?.trip.train.number,
    ).toBe('066Ш');
    expect(matchTrip([makeTrip('067К', [{ id: 'К', free: 4 }])], job)).toBeNull();
  });

  it('honors coachTypes priority order', () => {
    const job = makeJob({ coachTypes: ['К', 'П'] });
    // both available → prefer К (listed first)
    const m = matchTrip(
      [makeTrip('057К', [{ id: 'П', free: 5 }, { id: 'К', free: 5 }])],
      job,
    );
    expect(m?.wagonClass.id).toBe('К');
    // only П available → falls through to П
    const m2 = matchTrip(
      [makeTrip('057К', [{ id: 'П', free: 5 }, { id: 'К', free: 0 }])],
      job,
    );
    expect(m2?.wagonClass.id).toBe('П');
  });

  it('matches against real search.json data (skips the sold-out 021О)', () => {
    const trips = parseSearchTrips(searchFix);
    // С1 only exists on 715К (32 free) → it wins over the sold-out first trip
    const m = matchTrip(trips, makeJob({ coachTypes: ['С1'] }));
    expect(m?.trip.train.number).toBe('715К');
    expect(m?.wagonClass.id).toBe('С1');
    expect(m?.wagonClass.free_seats).toBe(32);
    // П only exists on the sold-out 021О (0 free) → no match
    expect(matchTrip(trips, makeJob({ coachTypes: ['П'] }))).toBeNull();
  });
});

describe('huntOnce', () => {
  it('pauses as not_authenticated when there is no session', async () => {
    vi.mocked(getAuthHeaders).mockResolvedValue(null);
    await saveJob(makeJob({ id: 'a' }));

    await huntOnce('a');

    const job = await getJob('a');
    expect(job?.state).toBe('paused');
    expect(job?.pauseReason).toBe('not_authenticated');
    expect(vi.mocked(searchTrips)).not.toHaveBeenCalled();
  });

  it('stays hunting and counts the attempt on no match', async () => {
    await saveJob(makeJob({ id: 'b', attempts: 2 }));
    vi.mocked(searchTrips).mockResolvedValue([
      makeTrip('057К', [{ id: 'П', free: 0 }]),
    ]);

    await huntOnce('b');

    const job = await getJob('b');
    expect(job?.state).toBe('hunting');
    expect(job?.attempts).toBe(3);
    expect(job?.lastAttemptAt).toBeTypeOf('number');
  });

  it('transitions to reserving and dispatches the match', async () => {
    await saveJob(makeJob({ id: 'c' }));
    vi.mocked(searchTrips).mockResolvedValue([
      makeTrip('057К', [{ id: 'П', free: 3 }]),
    ]);

    const dispatched: ReserveDispatch[] = [];
    setReserveDispatcher((d) => {
      dispatched.push(d);
    });

    await huntOnce('c');

    const job = await getJob('c');
    expect(job?.state).toBe('reserving');
    expect(reserveInFlightJob()).toBe('c');
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]?.match.trip.train.number).toBe('057К');
    // monitor alarm is cleared while reserving
    expect(await fakeBrowser.alarms.get(tickAlarmName('c'))).toBeFalsy();
  });

  it('default dispatcher returns the job to hunting (Step 5 not wired)', async () => {
    await saveJob(makeJob({ id: 'c2' }));
    vi.mocked(searchTrips).mockResolvedValue([
      makeTrip('057К', [{ id: 'П', free: 3 }]),
    ]);

    await huntOnce('c2');

    const job = await getJob('c2');
    expect(job?.state).toBe('hunting');
    expect(reserveInFlightJob()).toBeNull();
  });

  it('applies 429 backoff (doubles interval, sets pausedUntil)', async () => {
    await saveJob(makeJob({ id: 'd', pollIntervalMs: 15_000 }));
    vi.mocked(searchTrips).mockRejectedValue(new RateLimitError(undefined));

    const before = Date.now();
    await huntOnce('d');

    const job = await getJob('d');
    expect(job?.state).toBe('hunting');
    expect(job?.pollIntervalMs).toBe(30_000);
    expect(job?.pausedUntil ?? 0).toBeGreaterThanOrEqual(before + 30_000);
  });

  it('pauses on AuthError thrown mid-flight', async () => {
    await saveJob(makeJob({ id: 'e' }));
    vi.mocked(searchTrips).mockRejectedValue(new AuthError());

    await huntOnce('e');

    expect((await getJob('e'))?.state).toBe('paused');
    expect((await getJob('e'))?.pauseReason).toBe('not_authenticated');
  });

  it('fails the job when maxAttempts is reached', async () => {
    await saveJob(makeJob({ id: 'f', attempts: 0, maxAttempts: 1 }));
    vi.mocked(searchTrips).mockResolvedValue([
      makeTrip('057К', [{ id: 'П', free: 0 }]),
    ]);

    await huntOnce('f');

    expect((await getJob('f'))?.state).toBe('failed');
  });

  it('skips when another job holds the reserve lock', async () => {
    await saveJob(makeJob({ id: 'g1' }));
    await saveJob(makeJob({ id: 'g2' }));
    setReserveDispatcher(() => {}); // keep the lock held by g1
    vi.mocked(searchTrips).mockResolvedValue([
      makeTrip('057К', [{ id: 'П', free: 9 }]),
    ]);

    await huntOnce('g1'); // g1 acquires the lock → reserving
    expect(reserveInFlightJob()).toBe('g1');

    await huntOnce('g2'); // blocked by the lock
    expect((await getJob('g2'))?.state).toBe('hunting');
    expect((await getJob('g2'))?.attempts).toBe(0);
  });
});

describe('alarm dispatch', () => {
  it('re-arms the monitor alarm after a no-match tick', async () => {
    await saveJob(makeJob({ id: 'h', pollIntervalMs: 7_000 }));
    vi.mocked(searchTrips).mockResolvedValue([
      makeTrip('057К', [{ id: 'П', free: 0 }]),
    ]);

    await handleAlarm(tickAlarmName('h'));

    expect(await fakeBrowser.alarms.get(tickAlarmName('h'))).toBeTruthy();
    expect((await getJob('h'))?.attempts).toBe(1);
  });

  it('does not re-arm a paused job', async () => {
    vi.mocked(getAuthHeaders).mockResolvedValue(null);
    await saveJob(makeJob({ id: 'i' }));

    await handleAlarm(tickAlarmName('i'));

    expect((await getJob('i'))?.state).toBe('paused');
    expect(await fakeBrowser.alarms.get(tickAlarmName('i'))).toBeFalsy();
  });
});

describe('lifecycle', () => {
  it('startJob (monitor) sets hunting and arms an alarm', async () => {
    await saveJob(makeJob({ id: 'm', state: 'idle' }));
    await startJob(makeJob({ id: 'm', state: 'idle' }));

    expect((await getJob('m'))?.state).toBe('hunting');
    expect(await fakeBrowser.alarms.get(tickAlarmName('m'))).toBeTruthy();
  });

  it('startJob (scheduled, future) arms a warmup alarm and waits', async () => {
    const startAt = Date.now() + 60_000;
    const job = makeJob({ id: 's', mode: 'scheduled', state: 'idle', startAt });
    await saveJob(job);
    await startJob(job);

    expect((await getJob('s'))?.state).toBe('scheduled');
    expect(await fakeBrowser.alarms.get(warmupAlarmName('s'))).toBeTruthy();
    expect(await fakeBrowser.alarms.get(tickAlarmName('s'))).toBeFalsy();
  });

  it('pause / cancel / delete clear alarms and update state', async () => {
    await saveJob(makeJob({ id: 'p' }));
    await startJob(makeJob({ id: 'p', state: 'idle' }));
    expect(await fakeBrowser.alarms.get(tickAlarmName('p'))).toBeTruthy();

    await pauseJob('p');
    expect((await getJob('p'))?.state).toBe('paused');
    expect(await fakeBrowser.alarms.get(tickAlarmName('p'))).toBeFalsy();

    await cancelJob('p');
    expect((await getJob('p'))?.state).toBe('cancelled');

    await removeJob('p');
    expect(await getJob('p')).toBeUndefined();
  });
});
