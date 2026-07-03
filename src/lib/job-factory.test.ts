import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import { createJobDraft, type JobFormInput } from './job-factory';

const KYIV = { id: 2200001, name: 'Київ-Пас' };
const LVIV = { id: 2218218, name: 'Татарів' };

function input(over: Partial<JobFormInput> = {}): JobFormInput {
  return {
    from: KYIV,
    to: LVIV,
    date: '2026-07-19',
    preferredTrains: [],
    coachTypes: [],
    passengerIds: [1],
    bedding: true,
    mode: 'monitor',
    ...over,
  };
}

beforeEach(() => {
  fakeBrowser.reset();
});

describe('createJobDraft', () => {
  it('builds a monitor job with a clamped poll interval and default name', () => {
    const { job, errors } = createJobDraft(input({ pollIntervalSec: 1 }));
    expect(errors).toEqual([]);
    expect(job?.mode).toBe('monitor');
    expect(job?.pollIntervalMs).toBe(5_000); // 1s clamped up to the 5s floor
    expect(job?.name).toContain('Київ-Пас → Татарів');
    expect(job?.state).toBe('idle');
  });

  it('rejects identical from/to and empty passengers', () => {
    const r1 = createJobDraft(input({ to: KYIV }));
    expect(r1.job).toBeUndefined();
    expect(r1.errors.some((e) => e.includes('відрізнятися'))).toBe(true);

    const r2 = createJobDraft(input({ passengerIds: [] }));
    expect(r2.errors.some((e) => e.includes('пасажира'))).toBe(true);
  });

  it('requires a future startAt for scheduled mode and clamps the sprint', () => {
    const past = createJobDraft(
      input({ mode: 'scheduled', startAt: 1_000, sprintIntervalMs: 50 }),
      2_000,
    );
    expect(past.job).toBeUndefined();

    const future = createJobDraft(
      input({ mode: 'scheduled', startAt: 10_000, sprintIntervalMs: 50 }),
      2_000,
    );
    expect(future.errors).toEqual([]);
    expect(future.job?.startAt).toBe(10_000);
    expect(future.job?.sprintIntervalMs).toBe(200); // 50ms clamped up to the 200ms floor
  });

  it('blocks native mode when discovery says it is unavailable', () => {
    const { job, errors } = createJobDraft(
      input({ mode: 'native', nativeAvailable: false }),
    );
    expect(job).toBeUndefined();
    expect(errors.some((e) => e.includes('Нативний'))).toBe(true);
  });

  it('dedupes trains/coach/passengers and validates the date format', () => {
    const ok = createJobDraft(
      input({ preferredTrains: ['057К', '057К'], coachTypes: ['П', 'П'], passengerIds: [1, 1, 2] }),
    );
    expect(ok.job?.preferredTrains).toEqual(['057К']);
    expect(ok.job?.coachTypes).toEqual(['П']);
    expect(ok.job?.passengerIds).toEqual([1, 2]);

    const bad = createJobDraft(input({ date: '19.07.2026' }));
    expect(bad.errors.some((e) => e.includes('РРРР-ММ-ДД'))).toBe(true);
  });

  it('threads manual seats, locks the match, and drops seat prefs', () => {
    const match = { tripId: 11287381, trainNumber: '066П', classId: 'К' };
    const { job, errors } = createJobDraft(
      input({
        passengerIds: [1, 2],
        manualSeats: { wagonNumber: '6', seats: [14, 16, 14] },
        manualMatch: match,
        seatPrefs: { adjacent: true },
      }),
    );
    expect(errors).toEqual([]);
    expect(job?.manualSeats).toEqual({ wagonNumber: '6', seats: [14, 16] }); // deduped
    expect(job?.lastMatch).toEqual(match);
    expect(job?.seatPrefs).toBeUndefined(); // manual seats override prefs
  });

  it('rejects a manual-seat count that differs from the passenger count', () => {
    const { job, errors } = createJobDraft(
      input({
        passengerIds: [1, 2],
        manualSeats: { wagonNumber: '6', seats: [14] },
      }),
    );
    expect(job).toBeUndefined();
    expect(errors.some((e) => e.includes('дорівнювати кількості пасажирів'))).toBe(true);
  });
});
