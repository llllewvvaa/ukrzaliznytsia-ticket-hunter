import { describe, expect, it } from 'vitest';
import { resolveProbeDecision } from './session-probe';
import { extractSession, storageFromSnapshot } from './auth-extractor';
import type { ExtractedSession } from './auth-extractor';

const SESSION: ExtractedSession = {
  authToken: 'aaaaaaaa.bbbbbbbb.cccccccc',
  sessionId: '00000000-0000-4000-8000-000000000000',
  userId: 1000001,
};

describe('resolveProbeDecision', () => {
  it('sets the session whenever a probe found one', () => {
    expect(resolveProbeDecision(true, SESSION, true)).toEqual({
      action: 'set',
      session: SESSION,
    });
    expect(resolveProbeDecision(false, SESSION, false)).toEqual({
      action: 'set',
      session: SESSION,
    });
  });

  it('invalidates only when a live tab was probed and a session was cached', () => {
    expect(resolveProbeDecision(true, null, true)).toEqual({ action: 'invalidate' });
  });

  it('keeps the cache when nothing was probed (discarded/navigating tabs)', () => {
    expect(resolveProbeDecision(false, null, true)).toEqual({ action: 'keep' });
  });

  it('keeps when logged out and there was nothing cached to drop', () => {
    expect(resolveProbeDecision(true, null, false)).toEqual({ action: 'keep' });
  });
});

describe('storageFromSnapshot', () => {
  it('adapts a plain localStorage dump for extractSession', () => {
    const snapshot = {
      auth: JSON.stringify({ accessToken: SESSION.authToken, user: { id: SESSION.userId } }),
      session: JSON.stringify({ sessionId: SESSION.sessionId }),
      unrelated: 'plain-value',
    };
    expect(extractSession(storageFromSnapshot(snapshot))).toEqual(SESSION);
  });

  it('yields no session from a logged-out snapshot', () => {
    expect(extractSession(storageFromSnapshot({ foo: 'bar' }))).toBeNull();
  });
});
