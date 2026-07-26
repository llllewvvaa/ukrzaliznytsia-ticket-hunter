import { browser } from 'wxt/browser';

export const RPC_PORT = 'uz-rpc';
export const KEEPALIVE_PORT = 'uz-keepalive';

export const RESERVE_METHOD = 'reserveNow';
export const RESERVE_PING = 'reservePing';
export const RESERVE_STATUS = 'reserveStatus';

export const CAPTCHA_RESOLVED = 'captchaResolved' as const;

export interface CaptchaResolvedMessage {
  type: typeof CAPTCHA_RESOLVED;
  jobId: string;
}

export function isCaptchaResolvedMessage(msg: unknown): msg is CaptchaResolvedMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    (msg as { type?: string }).type === CAPTCHA_RESOLVED &&
    typeof (msg as { jobId?: unknown }).jobId === 'string'
  );
}

type Port = ReturnType<typeof browser.runtime.connect>;

export interface RpcRequest {
  kind: 'req';
  id: string;
  method: string;
  params?: unknown;
}

export interface RpcResponse {
  kind: 'res';
  id: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

export interface RpcEvent {
  kind: 'evt';
  channel: string;
  payload: unknown;
}

export type RpcMessage = RpcRequest | RpcResponse | RpcEvent;

function isRpcMessage(msg: unknown): msg is RpcMessage {
  return typeof msg === 'object' && msg !== null && 'kind' in msg;
}

export interface RpcClient {
  call<T = unknown>(method: string, params?: unknown, timeoutMs?: number): Promise<T>;
  on(channel: string, cb: (payload: unknown) => void): () => void;
  disconnect(): void;
}

function disconnectReason(): string {
  const detail = (globalThis as { chrome?: { runtime?: { lastError?: { message?: string } } } })
    .chrome?.runtime?.lastError?.message;
  return detail ? `port disconnected: ${detail}` : 'port disconnected';
}

export function connectToTab(tabId: number): RpcClient {
  const port = browser.tabs.connect(tabId, { name: RPC_PORT });
  const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  const listeners = new Map<string, Set<(payload: unknown) => void>>();

  port.onMessage.addListener((msg: unknown) => {
    if (!isRpcMessage(msg)) return;
    if (msg.kind === 'res') {
      const entry = pending.get(msg.id);
      if (!entry) return;
      pending.delete(msg.id);
      if (msg.ok) entry.resolve(msg.result);
      else entry.reject(new Error(msg.error ?? 'rpc error'));
    } else if (msg.kind === 'evt') {
      listeners.get(msg.channel)?.forEach((cb) => cb(msg.payload));
    }
  });

  port.onDisconnect.addListener(() => {
    const reason = disconnectReason();
    for (const { reject } of pending.values()) reject(new Error(reason));
    pending.clear();
  });

  return {
    call<T = unknown>(method: string, params?: unknown, timeoutMs = 30_000): Promise<T> {
      const id = crypto.randomUUID();
      return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`rpc timeout: ${method}`));
        }, timeoutMs);
        pending.set(id, {
          resolve: (v) => {
            clearTimeout(timer);
            resolve(v as T);
          },
          reject: (e) => {
            clearTimeout(timer);
            reject(e);
          },
        });
        const req: RpcRequest = {
          kind: 'req',
          id,
          method,
          ...(params !== undefined ? { params } : {}),
        };
        port.postMessage(req);
      });
    },
    on(channel, cb) {
      const set = listeners.get(channel) ?? new Set();
      set.add(cb);
      listeners.set(channel, set);
      return () => set.delete(cb);
    },
    disconnect() {
      port.disconnect();
    },
  };
}

export interface RpcContext {
  emit(channel: string, payload: unknown): void;
}

export type RpcHandler = (params: unknown, ctx: RpcContext) => unknown | Promise<unknown>;

export function serveInContentScript(handlers: Record<string, RpcHandler>): () => void {
  const onConnect = (port: Port): void => {
    if (port.name !== RPC_PORT) return;
    const ctx: RpcContext = {
      emit(channel, payload) {
        const evt: RpcEvent = { kind: 'evt', channel, payload };
        port.postMessage(evt);
      },
    };
    port.onMessage.addListener((msg: unknown) => {
      if (!isRpcMessage(msg) || msg.kind !== 'req') return;
      void handleRequest(msg, handlers, ctx, port);
    });
  };
  browser.runtime.onConnect.addListener(onConnect);
  return () => browser.runtime.onConnect.removeListener(onConnect);
}

async function handleRequest(
  req: RpcRequest,
  handlers: Record<string, RpcHandler>,
  ctx: RpcContext,
  port: Port,
): Promise<void> {
  const handler = handlers[req.method];
  try {
    if (!handler) throw new Error(`unknown rpc method: ${req.method}`);
    const result = await handler(req.params, ctx);
    const res: RpcResponse = { kind: 'res', id: req.id, ok: true, result };
    port.postMessage(res);
  } catch (err) {
    const res: RpcResponse = {
      kind: 'res',
      id: req.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
    port.postMessage(res);
  }
}

// keep-alive port: an open connection holds the SW awake during a sprint
export function openKeepAlive(): Port {
  return browser.runtime.connect({ name: KEEPALIVE_PORT });
}

export function registerKeepAlive(onChange?: (alive: boolean) => void): void {
  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== KEEPALIVE_PORT) return;
    onChange?.(true);
    port.onDisconnect.addListener(() => onChange?.(false));
  });
}
