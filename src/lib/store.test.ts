import { describe, it, expect, beforeEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import {
  listJobs,
  getJob,
  saveJob,
  patchJob,
  deleteJob,
  appendLog,
  getLogs,
  subscribe,
  clearAll,
  newJobId,
  LOG_CAP,
  type StoreChange,
} from './store';
import type { HuntJob, LogEntry } from './models';

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

function makeLog(jobId: string, i: number): LogEntry {
  return {
    jobId,
    ts: Date.now() + i,
    endpoint: 'GET /api/v3/trips/{id}',
    outcome: 'no_match',
    detail: `attempt ${i}`,
  };
}

beforeEach(() => {
  fakeBrowser.reset();
});

describe('store: jobs CRUD', () => {
  it('saves and reads a job', async () => {
    const job = makeJob();
    await saveJob(job);

    const got = await getJob(job.id);
    expect(got?.id).toBe(job.id);
    expect(got?.name).toBe('Kyiv → Lviv');
    expect(got?.passengerIds).toEqual([2000001]);
  });

  it('returns undefined for a missing job', async () => {
    expect(await getJob('nope')).toBeUndefined();
  });

  it('lists jobs newest-first by createdAt', async () => {
    await saveJob(makeJob({ id: 'a', createdAt: 1000 }));
    await saveJob(makeJob({ id: 'b', createdAt: 3000 }));
    await saveJob(makeJob({ id: 'c', createdAt: 2000 }));

    const ids = (await listJobs()).map((j) => j.id);
    expect(ids).toEqual(['b', 'c', 'a']);
  });

  it('refreshes updatedAt on save', async () => {
    const job = makeJob({ updatedAt: 1 });
    const saved = await saveJob(job);
    expect(saved.updatedAt).toBeGreaterThan(1);
  });

  it('patches an existing job and is a no-op for a missing one', async () => {
    const job = makeJob({ state: 'hunting' });
    await saveJob(job);

    const patched = await patchJob(job.id, { state: 'paused', pauseReason: 'user' });
    expect(patched?.state).toBe('paused');
    expect(patched?.pauseReason).toBe('user');
    // unrelated fields preserved
    expect(patched?.name).toBe(job.name);

    expect(await patchJob('missing', { state: 'failed' })).toBeUndefined();
  });

  it('deletes a job and its logs', async () => {
    const job = makeJob();
    await saveJob(job);
    await appendLog(makeLog(job.id, 0));

    await deleteJob(job.id);
    expect(await getJob(job.id)).toBeUndefined();
    expect(await getLogs(job.id)).toEqual([]);
  });
});

describe('store: logs', () => {
  it('appends logs and returns them newest-first', async () => {
    const jobId = 'job-1';
    await appendLog(makeLog(jobId, 1));
    await appendLog(makeLog(jobId, 2));
    await appendLog(makeLog(jobId, 3));

    const logs = await getLogs(jobId);
    expect(logs.map((l) => l.detail)).toEqual(['attempt 3', 'attempt 2', 'attempt 1']);
  });

  it('respects the limit argument', async () => {
    const jobId = 'job-2';
    for (let i = 0; i < 5; i++) await appendLog(makeLog(jobId, i));

    const logs = await getLogs(jobId, 2);
    expect(logs).toHaveLength(2);
    expect(logs[0]?.detail).toBe('attempt 4');
  });

  it(`caps stored logs at LOG_CAP (${LOG_CAP})`, async () => {
    const jobId = 'job-3';
    for (let i = 0; i < LOG_CAP + 25; i++) await appendLog(makeLog(jobId, i));

    const logs = await getLogs(jobId, LOG_CAP + 100);
    expect(logs).toHaveLength(LOG_CAP);
    // oldest retained should be entry #25 (0..24 dropped)
    expect(logs.at(-1)?.detail).toBe('attempt 25');
  });

  it('isolates logs per job', async () => {
    await appendLog(makeLog('A', 1));
    await appendLog(makeLog('B', 1));
    expect(await getLogs('A')).toHaveLength(1);
    expect(await getLogs('B')).toHaveLength(1);
  });
});

describe('store: subscribe', () => {
  it('notifies on job changes and stops after unsubscribe', async () => {
    const events: StoreChange[] = [];
    const unsub = subscribe((c) => events.push(c));

    await saveJob(makeJob());
    expect(events.some((e) => e.jobs)).toBe(true);

    const countAfterSave = events.length;
    unsub();
    await saveJob(makeJob());
    expect(events.length).toBe(countAfterSave);
  });

  it('flags log changes', async () => {
    const events: StoreChange[] = [];
    const unsub = subscribe((c) => events.push(c));
    await appendLog(makeLog('job-x', 1));
    expect(events.some((e) => e.logs)).toBe(true);
    unsub();
  });
});

describe('store: clearAll', () => {
  it('wipes jobs and logs', async () => {
    await saveJob(makeJob({ id: 'z' }));
    await appendLog(makeLog('z', 1));
    await clearAll();
    expect(await listJobs()).toEqual([]);
    expect(await getLogs('z')).toEqual([]);
  });
});
