export interface ExtractedSession {
  authToken: string;
  sessionId: string;
  userId: number;
}

export interface StorageLike {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const JWT_RE = /^[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}$/;

const TOKEN_KEYS = ['accesstoken', 'authtoken', 'token', 'jwt', 'bearer', 'idtoken'];
const SESSION_KEYS = ['sessionid', 'xsessionid', 'session'];
const USER_CONTEXT_RE = /(user|profile|auth|account)/;

function norm(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

export function looksLikeJwt(value: unknown): value is string {
  return typeof value === 'string' && JWT_RE.test(value);
}

interface Found {
  token?: string;
  sessionId?: string;
  userId?: number;
}

function scan(value: unknown, found: Found, parentKey = '', depth = 0): void {
  if (depth > 6 || value === null) return;

  if (Array.isArray(value)) {
    for (const item of value) scan(item, found, parentKey, depth + 1);
    return;
  }
  if (typeof value !== 'object') return;

  const parent = norm(parentKey);
  for (const [rawKey, v] of Object.entries(value as Record<string, unknown>)) {
    const key = norm(rawKey);

    if (found.token === undefined && typeof v === 'string') {
      if (TOKEN_KEYS.includes(key) && v.length >= 16) found.token = v;
      else if (looksLikeJwt(v)) found.token = v;
    }
    if (found.sessionId === undefined && typeof v === 'string') {
      if (SESSION_KEYS.includes(key) && v.length > 0) found.sessionId = v;
      else if (isUuid(v)) found.sessionId = v;
    }
    if (found.userId === undefined) {
      // generic `id` only counts inside a user/profile/auth container
      const isUserId =
        key === 'userid' || (key === 'id' && USER_CONTEXT_RE.test(parent));
      if (isUserId) {
        const n = typeof v === 'number' ? v : Number(v);
        if (Number.isInteger(n) && n > 0) found.userId = n;
      }
    }

    if (typeof v === 'object' && v !== null) scan(v, found, rawKey, depth + 1);
  }
}

function isComplete(
  found: Found,
): found is { token: string; sessionId: string; userId: number } {
  return (
    found.token !== undefined &&
    found.sessionId !== undefined &&
    found.userId !== undefined
  );
}

export function extractSession(storage: StorageLike): ExtractedSession | null {
  const found: Found = {};

  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key) continue;
    const raw = storage.getItem(key);
    if (!raw) continue;

    if (found.token === undefined && looksLikeJwt(raw)) found.token = raw;
    if (found.sessionId === undefined && isUuid(raw)) found.sessionId = raw;

    if (raw.startsWith('{') || raw.startsWith('[')) {
      try {
        // pass the storage key as root parent so a top-level `id` under an
        // auth/user/profile-keyed entry counts as the user id
        scan(JSON.parse(raw), found, key);
      } catch {
        // not JSON
      }
    }

    if (isComplete(found)) break;
  }

  return isComplete(found)
    ? { authToken: found.token, sessionId: found.sessionId, userId: found.userId }
    : null;
}

// Adapt a plain key→value dump (e.g. a localStorage snapshot returned by
// chrome.scripting.executeScript) to the StorageLike shape extractSession scans.
export function storageFromSnapshot(snapshot: Record<string, string>): StorageLike {
  const keys = Object.keys(snapshot);
  return {
    length: keys.length,
    key: (index) => keys[index] ?? null,
    getItem: (key) => snapshot[key] ?? null,
  };
}
