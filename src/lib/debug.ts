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
  const clean = redactEvent(ev);
  clean.seq = ++seq;
  log.push(clean);
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
    ...(input.reqHeaders ? { reqHeaders: input.reqHeaders } : {}),
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

// Stable non-crypto hash: lets a reviewer see whether two values are the same
// session/user across requests, without exposing the real id in a shared log.
function shortHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0').slice(0, 6);
}

const JWT_RE = /eyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const BEARER_RE = /Bearer\s+[A-Za-z0-9._~+/-]{8,}=*/gi;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
// PII / secret JSON keys → value replaced. Deliberately NOT bare "name" (station,
// train and coach-class names are not personal and are needed for diagnosis).
const PII_KEY_RE =
  /("(?:first_?name|last_?name|middle_?name|patronymic|full_?name|passenger_?name|e-?mail|phone_?number|phone|birth_?day|birth_?date|dob|document_?number|passport_?number|passport_?series|passport|document|inn|ipn|tax_?id|card_?number|card|pan|cvv|cvc|iban|password|passwd|pin|otp|access_?token|refresh_?token|id_?token|session_?id|token|jwt|pdf_url)"\s*:\s*)"[^"]*"/gi;

// Scrub free text (URLs, error details, header values).
function scrubText(s: string): string {
  return s
    .replace(JWT_RE, 'jwt…')
    .replace(BEARER_RE, 'Bearer …')
    .replace(EMAIL_RE, '…@…')
    .replace(UUID_RE, (m) => `uuid:${shortHash(m)}`);
}

// Scrub a JSON-ish body: free-text secrets + known PII/secret keys.
export function redactBody(s: string): string {
  return scrubText(s).replace(PII_KEY_RE, '$1"…"');
}

const SECRET_HEADER_RE = /^(authorization|proxy-authorization|cookie|set-cookie|x-auth-token|x-api-key)$/i;

export function redactHeaders(h: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) {
    if (SECRET_HEADER_RE.test(k)) out[k] = redactToken(v);
    else if (/^x-session-id$/i.test(k)) out[k] = `sid:${shortHash(v)}`;
    else if (/^x-user-agent$/i.test(k)) out[k] = scrubText(v).replace(/User\/\d+/gi, 'User/#');
    else out[k] = scrubText(v);
  }
  return out;
}

function redactToken(v: string): string {
  const tok = /^(?:Bearer\s+)?(\S+)/.exec(v)?.[1] ?? v;
  return `Bearer jwt…(${tok.length})`;
}

// Single choke point — every stored event (any context/kind) is scrubbed here, so
// the exported log is safe to attach to a public issue.
export function redactEvent(ev: DebugEvent): DebugEvent {
  const e = { ...ev };
  if (e.url != null) e.url = scrubText(e.url);
  if (e.from != null) e.from = scrubText(e.from);
  if (e.to != null) e.to = scrubText(e.to);
  if (e.label != null) e.label = scrubText(e.label);
  if (e.reqBody != null) e.reqBody = redactBody(e.reqBody);
  if (e.resBody != null) e.resBody = redactBody(e.resBody);
  if (e.detail != null) e.detail = redactBody(e.detail);
  if (e.reqHeaders) e.reqHeaders = redactHeaders(e.reqHeaders);
  if (e.sessionId != null) e.sessionId = `sid:${shortHash(e.sessionId)}`;
  if (e.userId != null) e.userId = `usr:${shortHash(String(e.userId))}`;
  return e;
}
