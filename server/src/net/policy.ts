export const MONITOR_MIN_MS = 5_000;
export const MONITOR_DEFAULT_MS = 15_000;
export const RATE_LIMIT_MIN_PAUSE_MS = 30_000;
export const BACKOFF_CAP_MS = 60_000;
export const GATE_PAUSE_MS = 10 * 60_000;
export const GATE_TRIP_THRESHOLD = 3;

export type ResponseKind =
  | 'ok'
  | 'rate_limited'
  | 'gated'
  | 'not_found'
  | 'server_error'
  | 'client_error';

export function classifyStatus(status: number): ResponseKind {
  if (status >= 200 && status < 300) return 'ok';
  if (status === 429) return 'rate_limited';
  if (status === 441) return 'gated';
  if (status === 404) return 'not_found';
  if (status >= 500) return 'server_error';
  return 'client_error';
}

export function isRetryable(kind: ResponseKind): boolean {
  return kind === 'server_error' || kind === 'rate_limited';
}

export function retryDelayMs(attempt: number, kind: ResponseKind, retryAfterSec?: number): number {
  if (kind === 'rate_limited') {
    return Math.max(RATE_LIMIT_MIN_PAUSE_MS, (retryAfterSec ?? 0) * 1_000);
  }
  const base = MONITOR_MIN_MS * 2 ** Math.max(0, attempt - 1);
  return Math.min(base, BACKOFF_CAP_MS);
}

export interface GateState {
  consecutive: number;
  pausedUntil: number;
  needsReload: boolean;
  tripped: boolean;
}

export const initialGateState: GateState = {
  consecutive: 0,
  pausedUntil: 0,
  needsReload: false,
  tripped: false,
};

export function onResponse(state: GateState, kind: ResponseKind, now: number): GateState {
  if (kind !== 'gated') {
    return { consecutive: 0, pausedUntil: 0, needsReload: false, tripped: false };
  }
  const consecutive = state.consecutive + 1;
  return {
    consecutive,
    pausedUntil: now + GATE_PAUSE_MS,
    needsReload: true,
    tripped: consecutive >= GATE_TRIP_THRESHOLD,
  };
}

export function isPaused(state: GateState, now: number): boolean {
  return now < state.pausedUntil;
}
