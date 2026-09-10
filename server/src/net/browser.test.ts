import { describe, expect, it } from 'vitest';
import { TransportTimeoutError, withDeadline } from './browser.js';
import { UzClient } from './client.js';
import { createMemoryCache } from './cache.js';
import { createMemoryRequestLog, summarize } from './log.js';
import type { PageFetchResult, UzTransport } from './browser.js';

describe('withDeadline', () => {
  it('passes a value that arrives in time', async () => {
    await expect(withDeadline(Promise.resolve('ok'), 50, '/x')).resolves.toBe('ok');
  });

  it('gives up on a call that never settles', async () => {
    await expect(withDeadline(new Promise(() => {}), 20, '/v3/trips')).rejects.toBeInstanceOf(
      TransportTimeoutError,
    );
  });

  it('names the path it was waiting on', async () => {
    await expect(withDeadline(new Promise(() => {}), 10, '/v3/trips')).rejects.toThrow('/v3/trips');
  });
});

function hangingTransport(hangs: number): { transport: UzTransport; reloads: () => number } {
  let calls = 0;
  let reloads = 0;
  return {
    transport: {
      async fetchPath(path): Promise<PageFetchResult> {
        calls += 1;
        if (calls <= hangs) throw new TransportTimeoutError(path);
        return { status: 200, body: '{"direct":[]}' };
      },
      async reload() {
        reloads += 1;
      },
      async close() {},
    },
    reloads: () => reloads,
  };
}

describe('client on a wedged page', () => {
  it('reloads the page and retries once', async () => {
    const scripted = hangingTransport(1);
    const log = createMemoryRequestLog();
    const client = new UzClient({
      transport: scripted.transport,
      log,
      cache: createMemoryCache(),
      sleep: async () => {},
    });
    const res = await client.get('/v3/trips');
    expect(res.status).toBe(200);
    expect(scripted.reloads()).toBe(1);
  });

  it('logs the stall as a gateway timeout', async () => {
    const scripted = hangingTransport(1);
    const log = createMemoryRequestLog();
    const client = new UzClient({
      transport: scripted.transport,
      log,
      cache: createMemoryCache(),
      sleep: async () => {},
    });
    await client.get('/v3/trips');
    expect(summarize(log).byStatus['504']).toBe(1);
  });

  it('gives up once the attempts run out', async () => {
    const scripted = hangingTransport(99);
    const client = new UzClient({
      transport: scripted.transport,
      log: createMemoryRequestLog(),
      cache: createMemoryCache(),
      sleep: async () => {},
    });
    await expect(client.get('/v3/trips', { maxAttempts: 2 })).rejects.toBeInstanceOf(TransportTimeoutError);
    expect(scripted.reloads()).toBe(2);
  });
});
