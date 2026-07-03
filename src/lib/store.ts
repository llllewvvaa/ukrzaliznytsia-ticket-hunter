import { browser } from 'wxt/browser';
import type { HuntJob, LogEntry } from './models';

const JOBS_KEY = 'jobs';
const LOGS_KEY = 'logs';

export const LOG_CAP = 200;

type JobsMap = Record<string, HuntJob>;
type LogsMap = Record<string, LogEntry[]>;

async function readMap<T>(key: string): Promise<Record<string, T>> {
  const res = await browser.storage.local.get(key);
  return (res[key] as Record<string, T> | undefined) ?? {};
}

async function writeMap<T>(key: string, value: Record<string, T>): Promise<void> {
  await browser.storage.local.set({ [key]: value });
}

const readJobs = (): Promise<JobsMap> => readMap<HuntJob>(JOBS_KEY);
const writeJobs = (jobs: JobsMap): Promise<void> => writeMap(JOBS_KEY, jobs);
const readLogs = (): Promise<LogsMap> => readMap<LogEntry[]>(LOGS_KEY);
const writeLogs = (logs: LogsMap): Promise<void> => writeMap(LOGS_KEY, logs);

export function newJobId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `job_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function listJobs(): Promise<HuntJob[]> {
  const jobs = await readJobs();
  return Object.values(jobs).sort((a, b) => b.createdAt - a.createdAt);
}

export async function getJob(id: string): Promise<HuntJob | undefined> {
  const jobs = await readJobs();
  return jobs[id];
}

export async function saveJob(job: HuntJob): Promise<HuntJob> {
  const jobs = await readJobs();
  const next: HuntJob = { ...job, updatedAt: Date.now() };
  jobs[next.id] = next;
  await writeJobs(jobs);
  return next;
}

export async function patchJob(
  id: string,
  patch: Partial<HuntJob>,
): Promise<HuntJob | undefined> {
  const jobs = await readJobs();
  const current = jobs[id];
  if (!current) return undefined;
  const next: HuntJob = { ...current, ...patch, id, updatedAt: Date.now() };
  jobs[id] = next;
  await writeJobs(jobs);
  return next;
}

export async function deleteJob(id: string): Promise<void> {
  const jobs = await readJobs();
  if (jobs[id]) {
    delete jobs[id];
    await writeJobs(jobs);
  }
  const logs = await readLogs();
  if (logs[id]) {
    delete logs[id];
    await writeLogs(logs);
  }
}

export async function appendLog(entry: LogEntry): Promise<void> {
  const logs = await readLogs();
  const list = logs[entry.jobId] ?? [];
  list.push(entry);
  logs[entry.jobId] = list.length > LOG_CAP ? list.slice(-LOG_CAP) : list;
  await writeLogs(logs);
}

export async function getLogs(
  jobId: string,
  limit = LOG_CAP,
): Promise<LogEntry[]> {
  const logs = await readLogs();
  const list = logs[jobId] ?? [];
  return list.slice(-limit).reverse();
}

export type StoreChange = { jobs: boolean; logs: boolean };

type StorageChangeMap = Record<string, { oldValue?: unknown; newValue?: unknown }>;

export function subscribe(cb: (change: StoreChange) => void): () => void {
  const listener = (changes: StorageChangeMap, areaName: string): void => {
    if (areaName !== 'local') return;
    const jobs = JOBS_KEY in changes;
    const logs = LOGS_KEY in changes;
    if (jobs || logs) cb({ jobs, logs });
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

export async function clearAll(): Promise<void> {
  await browser.storage.local.remove([JOBS_KEY, LOGS_KEY]);
}
