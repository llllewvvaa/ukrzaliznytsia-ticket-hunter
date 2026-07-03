import { browser } from 'wxt/browser';
import { DEBUG_EVENT } from './messages';
import type { DebugEvent } from './models';

export const DEBUG_FLAG_KEY = 'debug:enabled';
const LOG_KEY = 'debug:log';
const MAX_EVENTS = 5000;
const BODY_CAP = 4096;

const isServiceWorker = typeof window === 'undefined';

let enabled = false;

export function debugEnabled(): boolean {
  return enabled;
}

void browser.storage.local.get(DEBUG_FLAG_KEY).then((r) => {
  enabled = r[DEBUG_FLAG_KEY] === true;
});
browser.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && DEBUG_FLAG_KEY in changes) {
    enabled = changes[DEBUG_FLAG_KEY]?.newValue === true;
  }
});

export async function isDebugEnabledStored(): Promise<boolean> {
  const r = await browser.storage.local.get(DEBUG_FLAG_KEY);
  return r[DEBUG_FLAG_KEY] === true;
}

export async function setDebugEnabled(on: boolean): Promise<void> {
  enabled = on;
  await browser.storage.local.set({ [DEBUG_FLAG_KEY]: on });
}

// SW owns the log (single writer); other contexts forward events via messaging.
let log: DebugEvent[] | null = null;
let loading: Promise<void> | null = null;
let seq = 0;
let persistTimer: ReturnType<typeof setTimeout> | undefined;

async function ensureLoaded(): Promise<void> {
  if (log) return;
  if (!loading) {
    loading = browser.storage.local.get(LOG_KEY).then((r) => {
      const arr = r[LOG_KEY];
      log = Array.isArray(arr) ? (arr as DebugEvent[]) : [];
      seq = log[log.length - 1]?.seq ?? 0;
    });
  }
  await loading;
}

function schedulePersist(): void {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = undefined;
    if (log) void browser.storage.local.set({ [LOG_KEY]: log });
  }, 400);
}

export async function recordSW(ev: DebugEvent): Promise<void> {
  if (!enabled) return;
  await ensureLoaded();
  if (!log) return;
  ev.seq = ++seq;
  log.push(ev);
  if (log.length > MAX_EVENTS) log.splice(0, log.length - MAX_EVENTS);
  schedulePersist();
}

export async function getDebugLog(): Promise<DebugEvent[]> {
  await ensureLoaded();
  return log ?? [];
}

export async function clearDebugLog(): Promise<void> {
  await ensureLoaded();
  log = [];
  seq = 0;
  await browser.storage.local.set({ [LOG_KEY]: [] });
}

export function record(ev: DebugEvent): void {
  if (!enabled) return;
  if (isServiceWorker) void recordSW(ev);
  else void browser.runtime.sendMessage({ type: DEBUG_EVENT, event: ev }).catch(() => {});
}

export async function recordApiRequest(input: {
  method: string;
  url: string;
  reqHeaders?: Record<string, string>;
  reqBody?: unknown;
  // caller must clone the response before its body is consumed
  res?: Response;
  ms: number;
  error?: unknown;
}): Promise<void> {
  if (!enabled) return;
  let resBody: string | undefined;
  if (input.res) {
    try {
      resBody = cap(await input.res.text());
    } catch {
      // body already consumed / not text
    }
  }
  record({
    t: Date.now(),
    ctx: isServiceWorker ? 'sw' : 'content',
    kind: 'req',
    method: input.method,
    url: input.url,
    ...(input.res ? { status: input.res.status } : {}),
    ms: input.ms,
    ...(input.reqHeaders ? { reqHeaders: redactHeaders(input.reqHeaders) } : {}),
    ...(input.reqBody !== undefined ? { reqBody: cap(bodyToString(input.reqBody)) } : {}),
    ...(resBody !== undefined ? { resBody } : {}),
    ...(input.error ? { detail: String(input.error) } : {}),
  });
}

// Relay MAIN-world probe events to the SW and mirror the enabled flag to it.
export function startPageDebugBridge(): void {
  if (isServiceWorker) return;
  const postCtl = (on: boolean): void => {
    try {
      window.postMessage({ __uzDebugCtl: true, enabled: on }, location.origin);
    } catch {
      // ignore
    }
  };

  window.addEventListener('message', (e: MessageEvent) => {
    if (e.source !== window) return;
    const d = e.data as { __uzDebug?: boolean; event?: DebugEvent } | undefined;
    if (d?.__uzDebug === true && d.event && enabled) {
      void browser.runtime
        .sendMessage({ type: DEBUG_EVENT, event: d.event })
        .catch(() => {});
    }
  });

  void isDebugEnabledStored().then((on) => {
    enabled = on;
    postCtl(on);
  });
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && DEBUG_FLAG_KEY in changes) {
      postCtl(changes[DEBUG_FLAG_KEY]?.newValue === true);
    }
  });
}

function bodyToString(b: unknown): string {
  if (b == null) return '';
  if (typeof b === 'string') return b;
  try {
    return JSON.stringify(b);
  } catch {
    return String(b);
  }
}

function cap(s: string): string {
  const red = redactBody(s);
  return red.length > BODY_CAP ? `${red.slice(0, BODY_CAP)}…(+${red.length - BODY_CAP})` : red;
}

// Only the Authorization JWT is stripped; x-session-id is kept on purpose — it's
// the key signal for diagnosing cart/session mismatches.
export function redactHeaders(h: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) {
    out[k] = /^authorization$/i.test(k) ? redactToken(v) : v;
  }
  return out;
}

function redactToken(v: string): string {
  const tok = /^(?:Bearer\s+)?(\S+)/.exec(v)?.[1] ?? v;
  return `Bearer jwt…(${tok.length})`;
}

function redactBody(s: string): string {
  return s
    .replace(/eyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, 'jwt…')
    .replace(
      /("(?:first_name|last_name|firstName|lastName|middle_name|patronymic|email|phone|document_number)"\s*:\s*)"[^"]*"/gi,
      '$1"…"',
    );
}
