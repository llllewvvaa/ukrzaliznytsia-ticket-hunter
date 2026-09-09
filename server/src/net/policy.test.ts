import { describe, expect, it } from 'vitest';
import {
  BACKOFF_CAP_MS,
  GATE_PAUSE_MS,
  RATE_LIMIT_MIN_PAUSE_MS,
  classifyStatus,
  initialGateState,
  isPaused,
  isRetryable,
  onResponse,
  retryDelayMs,
} from './policy.js';

describe('classifyStatus', () => {
  it('maps the codes the UZ API actually returns', () => {
    expect(classifyStatus(200)).toBe('ok');
    expect(classifyStatus(429)).toBe('rate_limited');
    expect(classifyStatus(441)).toBe('gated');
    expect(classifyStatus(404)).toBe('not_found');
    expect(classifyStatus(503)).toBe('server_error');
    expect(classifyStatus(401)).toBe('client_error');
  });

  it('retries only what is worth retrying', () => {
    expect(isRetryable('rate_limited')).toBe(true);
    expect(isRetryable('server_error')).toBe(true);
    expect(isRetryable('gated')).toBe(false);
    expect(isRetryable('not_found')).toBe(false);
  });
});

describe('retryDelayMs', () => {
  it('honours the fair-play pause after 429', () => {
    expect(retryDelayMs(1, 'rate_limited')).toBe(RATE_LIMIT_MIN_PAUSE_MS);
  });

  it('obeys a longer retry-after header', () => {
    expect(retryDelayMs(1, 'rate_limited', 90)).toBe(90_000);
  });

  it('waits at least fifteen seconds after a server error and doubles from there', () => {
    expect(retryDelayMs(1, 'server_error')).toBe(15_000);
    expect(retryDelayMs(2, 'server_error')).toBe(30_000);
    expect(retryDelayMs(9, 'server_error')).toBe(BACKOFF_CAP_MS);
  });
});

describe('gate state', () => {
  it('pauses and asks for a reload on the first 441', () => {
    const state = onResponse(initialGateState, 'gated', 1_000);
    expect(state.consecutive).toBe(1);
    expect(state.needsReload).toBe(true);
    expect(state.pausedUntil).toBe(1_000 + GATE_PAUSE_MS);
    expect(state.tripped).toBe(false);
  });

  it('trips the breaker after three gated answers in a row', () => {
    let state = initialGateState;
    for (const t of [1, 2, 3]) state = onResponse(state, 'gated', t);
    expect(state.tripped).toBe(true);
  });

  it('trips after a run of server errors and pauses', () => {
    let state = initialGateState;
    for (let i = 0; i < 5; i += 1) state = onResponse(state, 'server_error', 1_000);
    expect(state.tripped).toBe(true);
    expect(state.pausedUntil).toBeGreaterThan(1_000);
  });

  it('tolerates isolated server errors without pausing', () => {
    let state = onResponse(initialGateState, 'server_error', 1_000);
    state = onResponse(state, 'ok', 2_000);
    expect(state.tripped).toBe(false);
    expect(state.pausedUntil).toBe(0);
  });

  it('resets completely on any successful answer', () => {
    let state = onResponse(initialGateState, 'gated', 1_000);
    state = onResponse(state, 'ok', 2_000);
    expect(state).toEqual(initialGateState);
  });

  it('reports the pause window', () => {
    const state = onResponse(initialGateState, 'gated', 0);
    expect(isPaused(state, GATE_PAUSE_MS - 1)).toBe(true);
    expect(isPaused(state, GATE_PAUSE_MS + 1)).toBe(false);
  });
});
