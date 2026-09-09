import { describe, expect, it } from 'vitest';
import { GateTrippedError, UzClient, hashBody } from './client.js';
import { createMemoryCache } from './cache.js';
import { createMemoryRequestLog, summarize } from './log.js';
import type { PageFetchResult, UzTransport } from './browser.js';
import { GATE_PAUSE_MS, RATE_LIMIT_MIN_PAUSE_MS } from './policy.js';

interface Scripted {
  transport: UzTransport;
  calls: string[];
  reloads: number;
  headers: Record<string, string>[];
}

function scriptedTransport(responses: PageFetchResult[]): Scripted {
  const state: Scripted = { calls: [], reloads: 0, headers: [], transport: null as never };
  let index = 0;
  state.transport = {
    async fetchPath(path, headers) {
      state.calls.push(path);
      state.headers.push(headers);
      const next = responses[Math.min(index, responses.length - 1)]!;
      index += 1;
      return next;
    },
    async reload() {
      state.reloads += 1;
    },
    async close() {},
  };
  return state;
}

function makeClient(responses: PageFetchResult[], overrides: Partial<{ now: () => number }> = {}) {
  const scripted = scriptedTransport(responses);
  const log = createMemoryRequestLog();
  const slept: number[] = [];
  let session = 0;
  const client = new UzClient({
    transport: scripted.transport,
    log,
    cache: createMemoryCache(),
    now: overrides.now ?? (() => 1_000),
    sleep: async (ms) => {
      slept.push(ms);
    },
    newSessionId: () => `session-${++session}`,
  });
  return { client, scripted, log, slept };
}

describe('UzClient', () => {
  it('sends guest headers and no authorization', async () => {
    const { client, scripted } = makeClient([{ status: 200, body: '{"direct":[]}' }]);
    await client.get('/v3/trips?x=1');
    const sent = scripted.headers[0]!;
    expect(sent['x-user-agent']).toBe('UZ/2 Web/1 User/guest');
    expect(sent['authorization']).toBeUndefined();
  });

  it('returns parsed json and a stable body hash', async () => {
    const body = '{"direct":[{"id":1}]}';
    const { client } = makeClient([{ status: 200, body }]);
    const res = await client.get('/v3/trips');
    expect(res.json<{ direct: unknown[] }>().direct).toHaveLength(1);
    expect(res.hash).toBe(hashBody(body));
  });

  it('serves a second identical call from cache without touching the network', async () => {
    const { client, scripted, log } = makeClient([{ status: 200, body: '{"a":1}' }]);
    await client.get('/v3/trips', { ttlMs: 60_000 });
    await client.get('/v3/trips', { ttlMs: 60_000 });
    expect(scripted.calls).toHaveLength(1);
    expect(summarize(log)).toMatchObject({ total: 2, network: 1, cached: 1 });
  });

  it('retries a 429 after the fair-play pause', async () => {
    const { client, scripted, slept } = makeClient([
      { status: 429, body: '' },
      { status: 200, body: '{}' },
    ]);
    const res = await client.get('/v3/trips');
    expect(res.status).toBe(200);
    expect(scripted.calls).toHaveLength(2);
    expect(slept[0]).toBe(RATE_LIMIT_MIN_PAUSE_MS);
  });

  it('gives up after the attempt budget', async () => {
    const { client, scripted } = makeClient([{ status: 503, body: 'boom' }]);
    const res = await client.get('/v3/trips', { maxAttempts: 2 });
    expect(res.status).toBe(503);
    expect(scripted.calls).toHaveLength(2);
  });

  it('does not retry a 404', async () => {
    const { client, scripted } = makeClient([{ status: 404, body: '{}' }]);
    const res = await client.get('/v3/trips/1/wagons');
    expect(res.kind).toBe('not_found');
    expect(scripted.calls).toHaveLength(1);
  });

  it('on 441 rotates the session, reloads the page and pauses', async () => {
    const { client, scripted } = makeClient([{ status: 441, body: '{"recaptcha_link":"x"}' }]);
    const first = client.currentSessionId;
    await expect(client.get('/v3/trips')).rejects.toBeInstanceOf(GateTrippedError);
    expect(scripted.reloads).toBe(1);
    expect(client.currentSessionId).not.toBe(first);
    expect(client.gateState.pausedUntil).toBe(1_000 + GATE_PAUSE_MS);
  });

  it('refuses to call the network while the gate pause holds', async () => {
    const { client, scripted } = makeClient([{ status: 441, body: '' }]);
    await expect(client.get('/v3/trips')).rejects.toBeInstanceOf(GateTrippedError);
    await expect(client.get('/v3/trips')).rejects.toBeInstanceOf(GateTrippedError);
    expect(scripted.calls).toHaveLength(1);
  });

  it('logs every call with size and duration', async () => {
    const { client, log } = makeClient([{ status: 200, body: '12345' }]);
    await client.get('/stations?search=a');
    expect(log.entries()[0]).toMatchObject({ path: '/stations?search=a', status: 200, bytes: 5, cacheHit: false });
  });
});
