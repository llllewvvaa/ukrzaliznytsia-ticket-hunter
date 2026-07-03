import { describe, it, expect } from 'vitest';
import {
  extractSession,
  isUuid,
  looksLikeJwt,
  type StorageLike,
} from './auth-extractor';

class FakeStorage implements StorageLike {
  private readonly entries: [string, string][];
  constructor(obj: Record<string, string>) {
    this.entries = Object.entries(obj);
  }
  get length(): number {
    return this.entries.length;
  }
  key(i: number): string | null {
    return this.entries[i]?.[0] ?? null;
  }
  getItem(k: string): string | null {
    return this.entries.find(([kk]) => kk === k)?.[1] ?? null;
  }
}

const UUID = '00000000-0000-4000-8000-000000000000';
const JWT = 'aaaaaaaa.bbbbbbbb.cccccccc';

describe('auth-extractor helpers', () => {
  it('detects UUIDs', () => {
    expect(isUuid(UUID)).toBe(true);
    expect(isUuid('not-a-uuid')).toBe(false);
  });
  it('detects JWT-shaped strings', () => {
    expect(looksLikeJwt(JWT)).toBe(true);
    expect(looksLikeJwt('plain')).toBe(false);
  });
});

describe('extractSession', () => {
  it('extracts token + sessionId + userId from Pinia-persisted entries', () => {
    const storage = new FakeStorage({
      auth: JSON.stringify({ accessToken: JWT, user: { id: 1000001 } }),
      session: JSON.stringify({ sessionId: UUID }),
      unrelated: JSON.stringify({ foo: 'bar' }),
    });

    expect(extractSession(storage)).toEqual({
      authToken: JWT,
      sessionId: UUID,
      userId: 1000001,
    });
  });

  it('uses the storage key as context so a top-level id under `profile` counts', () => {
    const storage = new FakeStorage({
      profile: JSON.stringify({ id: 1000001, token: 'x'.repeat(40) }),
      'x-session-id': UUID,
    });
    const out = extractSession(storage);
    expect(out?.userId).toBe(1000001);
    expect(out?.sessionId).toBe(UUID);
    expect(out?.authToken).toHaveLength(40);
  });

  it('ignores a generic id outside a user/profile/auth context', () => {
    const storage = new FakeStorage({
      lastTrip: JSON.stringify({ id: 3000001 }),
      auth: JSON.stringify({ token: 'y'.repeat(30) }),
      sess: UUID,
    });
    // userId never found → whole extraction fails (null)
    expect(extractSession(storage)).toBeNull();
  });

  it('returns null when the token is missing', () => {
    const storage = new FakeStorage({
      session: JSON.stringify({ sessionId: UUID, user: { id: 1 } }),
    });
    expect(extractSession(storage)).toBeNull();
  });

  it('returns null for empty storage', () => {
    expect(extractSession(new FakeStorage({}))).toBeNull();
  });
});
