import { describe, expect, it } from 'vitest';
import { createRateLimiter } from './limiter.js';
import { UzClient } from './client.js';
import { createMemoryCache } from './cache.js';
import { createMemoryRequestLog } from './log.js';
import type { UzTransport } from './browser.js';

describe('rate limiter', () => {
  it('hands out the burst immediately', async () => {
    let clock = 0;
    const waits: number[] = [];
    const limiter = createRateLimiter({
      perHour: 360,
      burst: 3,
      now: () => clock,
      sleep: async (ms) => {
        waits.push(ms);
        clock += ms;
      },
    });
    for (let i = 0; i < 3; i += 1) await limiter.acquire();
    expect(waits).toEqual([]);
  });

  it('waits for a refill once the burst is gone', async () => {
    let clock = 0;
    const waits: number[] = [];
    const limiter = createRateLimiter({
      perHour: 360,
      burst: 1,
      now: () => clock,
      sleep: async (ms) => {
        waits.push(ms);
        clock += ms;
      },
    });
    await limiter.acquire();
    await limiter.acquire();
    expect(waits[0]).toBeGreaterThan(0);
  });

  it('caps every caller of the client, not just the watcher', async () => {
    let clock = 0;
    const waits: number[] = [];
    const transport: UzTransport = {
      async fetchPath() {
        return { status: 200, body: '{}' };
      },
      async reload() {},
      async close() {},
    };
    const client = new UzClient({
      transport,
      log: createMemoryRequestLog(),
      cache: createMemoryCache(),
      now: () => clock,
      limiter: createRateLimiter({
        perHour: 360,
        burst: 2,
        now: () => clock,
        sleep: async (ms) => {
          waits.push(ms);
          clock += ms;
        },
      }),
    });
    await client.get('/a');
    await client.get('/b');
    await client.get('/c');
    expect(waits.length).toBeGreaterThan(0);
  });

  it('lets an interactive call borrow while the background waits', async () => {
    let clock = 0;
    const waits: number[] = [];
    const limiter = createRateLimiter({
      perHour: 60,
      burst: 1,
      overdraft: 2,
      now: () => clock,
      sleep: async (ms) => {
        waits.push(ms);
        clock += ms;
      },
    });
    await limiter.acquire('background');
    await limiter.acquire('interactive');
    await limiter.acquire('interactive');
    expect(waits).toEqual([]);
    expect(limiter.tokens()).toBeLessThan(0);
  });

  it('makes the background wait until the overdraft is repaid', async () => {
    let clock = 0;
    const waits: number[] = [];
    const limiter = createRateLimiter({
      perHour: 3_600,
      burst: 1,
      overdraft: 1,
      now: () => clock,
      sleep: async (ms) => {
        waits.push(ms);
        clock += ms;
      },
    });
    await limiter.acquire('background');
    await limiter.acquire('interactive');
    await limiter.acquire('background');
    expect(waits.length).toBeGreaterThan(0);
  });

  it('stops borrowing once the overdraft is used up', async () => {
    let clock = 0;
    const waits: number[] = [];
    const limiter = createRateLimiter({
      perHour: 3_600,
      burst: 0,
      overdraft: 1,
      now: () => clock,
      sleep: async (ms) => {
        waits.push(ms);
        clock += ms;
      },
    });
    await limiter.acquire('interactive');
    await limiter.acquire('interactive');
    expect(waits.length).toBeGreaterThan(0);
  });

  it('never charges a cache hit', async () => {
    let clock = 0;
    const waits: number[] = [];
    const transport: UzTransport = {
      async fetchPath() {
        return { status: 200, body: '{"a":1}' };
      },
      async reload() {},
      async close() {},
    };
    const client = new UzClient({
      transport,
      log: createMemoryRequestLog(),
      cache: createMemoryCache(),
      now: () => clock,
      limiter: createRateLimiter({
        perHour: 360,
        burst: 1,
        now: () => clock,
        sleep: async (ms) => {
          waits.push(ms);
          clock += ms;
        },
      }),
    });
    await client.get('/a', { ttlMs: 60_000 });
    await client.get('/a', { ttlMs: 60_000 });
    expect(waits).toEqual([]);
  });
});
