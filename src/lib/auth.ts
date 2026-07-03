// Auth flows one way: the content script extracts the live session and posts it
// here; the SW only caches and consumes it, never writes back to the page.
import { browser } from 'wxt/browser';
import type { UzAuthHeaders, UzSession } from './models';

const SESSION_KEY = 'uzSession';

export const TOKEN_UPDATED = 'tokenUpdated' as const;
export const TOKEN_CLEARED = 'tokenCleared' as const;

export interface TokenUpdatedMessage {
  type: typeof TOKEN_UPDATED;
  payload: {
    authToken: string;
    sessionId: string;
    userId: number;
  };
}

export interface TokenClearedMessage {
  type: typeof TOKEN_CLEARED;
}

export type AuthMessage = TokenUpdatedMessage | TokenClearedMessage;

export function isAuthMessage(msg: unknown): msg is AuthMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    ((msg as { type?: string }).type === TOKEN_UPDATED ||
      (msg as { type?: string }).type === TOKEN_CLEARED)
  );
}

export async function getSession(): Promise<UzSession | null> {
  const res = await browser.storage.session.get(SESSION_KEY);
  return (res[SESSION_KEY] as UzSession | undefined) ?? null;
}

export async function setSession(
  data: TokenUpdatedMessage['payload'],
): Promise<UzSession> {
  const session: UzSession = {
    authToken: data.authToken,
    sessionId: data.sessionId,
    userId: data.userId,
    fetchedAt: Date.now(),
  };
  await browser.storage.session.set({ [SESSION_KEY]: session });
  return session;
}

export async function invalidate(): Promise<void> {
  await browser.storage.session.remove(SESSION_KEY);
}

export async function hasSession(): Promise<boolean> {
  return (await getSession()) !== null;
}

export function buildHeaders(session: UzSession): UzAuthHeaders {
  return {
    Authorization: `Bearer ${session.authToken}`,
    'x-session-id': session.sessionId,
    'x-user-agent': `UZ/2 Web/1 User/${session.userId}`,
    'x-client-locale': 'uk',
    accept: 'application/json',
  };
}

export async function getAuthHeaders(): Promise<UzAuthHeaders | null> {
  const session = await getSession();
  return session ? buildHeaders(session) : null;
}

export function registerAuthListener(): void {
  browser.runtime.onMessage.addListener((message: unknown) => {
    if (!isAuthMessage(message)) return;
    if (message.type === TOKEN_UPDATED) {
      void setSession(message.payload);
    } else {
      void invalidate();
    }
  });
}
