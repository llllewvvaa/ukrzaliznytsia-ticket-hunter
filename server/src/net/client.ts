import { createHash, randomUUID } from 'node:crypto';
import { buildGuestHeaders } from '../uz/headers.js';
import type { UzTransport } from './browser.js';
import type { RequestLog } from './log.js';
import type { ResponseCache } from './cache.js';
import type { RateLimiter } from './limiter.js';
import {
  classifyStatus,
  initialGateState,
  isPaused,
  isRetryable,
  onResponse,
  retryDelayMs,
  type GateState,
  type ResponseKind,
} from './policy.js';

export interface ClientDeps {
  transport: UzTransport;
  log: RequestLog;
  cache: ResponseCache;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  newSessionId?: () => string;
  limiter?: RateLimiter;
}

export interface FetchOptions {
  ttlMs?: number;
  maxAttempts?: number;
}

export interface UzResponse {
  status: number;
  kind: ResponseKind;
  body: string;
  hash: string;
  cacheHit: boolean;
  json<T = unknown>(): T;
}

export class GateTrippedError extends Error {
  constructor(public readonly pausedUntil: number) {
    super('uz_gate_tripped');
    this.name = 'GateTrippedError';
  }
}

export function hashBody(body: string): string {
  return createHash('sha256').update(body).digest('hex').slice(0, 16);
}

export class UzClient {
  private gate: GateState = initialGateState;
  private sessionId: string;

  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly newSessionId: () => string;

  constructor(private readonly deps: ClientDeps) {
    this.now = deps.now ?? (() => Date.now());
    this.sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.newSessionId = deps.newSessionId ?? (() => randomUUID());
    this.sessionId = this.newSessionId();
  }

  get gateState(): GateState {
    return this.gate;
  }

  get currentSessionId(): string {
    return this.sessionId;
  }

  async get(path: string, options: FetchOptions = {}): Promise<UzResponse> {
    const ttlMs = options.ttlMs ?? 0;
    const maxAttempts = options.maxAttempts ?? 2;

    if (ttlMs > 0) {
      const hit = this.deps.cache.get(path, this.now());
      if (hit) {
        this.deps.log.record({
          ts: this.now(),
          path,
          status: hit.status,
          ms: 0,
          cacheHit: true,
          bytes: hit.body.length,
        });
        return this.toResponse(hit.status, hit.body, hit.hash, true);
      }
    }

    if (isPaused(this.gate, this.now())) {
      throw new GateTrippedError(this.gate.pausedUntil);
    }

    let attempt = 0;
    for (;;) {
      attempt += 1;
      if (this.deps.limiter) await this.deps.limiter.acquire();
      const started = this.now();
      const raw = await this.deps.transport.fetchPath(path, buildGuestHeaders(this.sessionId));
      const kind = classifyStatus(raw.status);
      this.deps.log.record({
        ts: started,
        path,
        status: raw.status,
        ms: this.now() - started,
        cacheHit: false,
        bytes: raw.body.length,
      });

      this.gate = onResponse(this.gate, kind, this.now());
      if (kind !== 'gated' && this.gate.tripped) {
        await this.deps.transport.reload();
        throw new GateTrippedError(this.gate.pausedUntil);
      }
      if (kind === 'gated') {
        this.sessionId = this.newSessionId();
        await this.deps.transport.reload();
        throw new GateTrippedError(this.gate.pausedUntil);
      }

      if (kind === 'ok') {
        const hash = hashBody(raw.body);
        if (ttlMs > 0) {
          this.deps.cache.set(
            path,
            { body: raw.body, status: raw.status, hash, fetchedAt: this.now() },
            ttlMs,
          );
        }
        return this.toResponse(raw.status, raw.body, hash, false);
      }

      if (!isRetryable(kind) || attempt >= maxAttempts) {
        return this.toResponse(raw.status, raw.body, hashBody(raw.body), false);
      }

      await this.sleep(retryDelayMs(attempt, kind));
    }
  }

  private toResponse(status: number, body: string, hash: string, cacheHit: boolean): UzResponse {
    return {
      status,
      kind: classifyStatus(status),
      body,
      hash,
      cacheHit,
      json<T>(): T {
        return JSON.parse(body) as T;
      },
    };
  }
}
