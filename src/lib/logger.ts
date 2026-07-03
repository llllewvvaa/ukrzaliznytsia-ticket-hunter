import { appendLog } from './store';
import type { LogEntry, LogOutcome } from './models';

const MAX_DETAIL = 300;

function truncate(detail: string | undefined): string | undefined {
  if (!detail) return undefined;
  return detail.length > MAX_DETAIL ? `${detail.slice(0, MAX_DETAIL)}…` : detail;
}

export interface LogInput {
  jobId: string;
  endpoint: string;
  outcome: LogOutcome;
  httpStatus?: number;
  detail?: string;
}

export async function log(input: LogInput): Promise<void> {
  const entry: LogEntry = {
    jobId: input.jobId,
    ts: Date.now(),
    endpoint: input.endpoint,
    outcome: input.outcome,
    ...(input.httpStatus !== undefined ? { httpStatus: input.httpStatus } : {}),
    ...(input.detail !== undefined ? { detail: truncate(input.detail) } : {}),
  };

  const status = entry.httpStatus ? ` ${entry.httpStatus}` : '';
  const detail = entry.detail ? ` — ${entry.detail}` : '';
  // eslint-disable-next-line no-console
  console.debug(
    `[uz:${entry.jobId.slice(0, 8)}] ${entry.endpoint}${status} → ${entry.outcome}${detail}`,
  );

  await appendLog(entry);
}
