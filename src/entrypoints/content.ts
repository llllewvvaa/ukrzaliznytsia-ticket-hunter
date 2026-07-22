import { extractSession, type ExtractedSession } from '@/lib/api/auth-extractor';
import { TOKEN_CLEARED, TOKEN_UPDATED, buildHeaders, type AuthMessage } from '@/lib/api/auth';
import { configureApi } from '@/lib/api/uz-api';
import {
  RESERVE_METHOD,
  RESERVE_PING,
  RESERVE_STATUS,
  serveInContentScript,
  type RpcHandler,
} from '@/lib/engine/bridge';
import { executeReserve } from '@/lib/engine/reserve';
import { isSeedCartMessage } from '@/lib/messages';
import { record, startPageDebugBridge } from '@/lib/ui/debug';
import type { HuntJob, ReserveOutcome, UzAuthHeaders } from '@/lib/models';
import type { TripMatch } from '@/lib/engine/orchestrator';

function currentHeaders(): UzAuthHeaders | null {
  let session: ExtractedSession | null;
  try {
    session = extractSession(window.localStorage);
  } catch {
    return null;
  }
  return session ? buildHeaders({ ...session, fetchedAt: Date.now() }) : null;
}

export default defineContentScript({
  matches: ['https://booking.uz.gov.ua/*'],
  runAt: 'document_idle',
  main() {
    startPageDebugBridge();

    browser.runtime.onMessage.addListener((message: unknown) => {
      if (isSeedCartMessage(message)) {
        seedCheckoutCart(message.cartId);
        return Promise.resolve(true);
      }
      return undefined;
    });

    // In-page API client authenticates from the page's own live session.
    configureApi({
      headers: async () => currentHeaders(),
      onUnauthorized: () => {},
    });

    let lastToken: string | undefined;
    const pushSession = (): void => {
      const session = extractSessionSafe();
      if (session && session.authToken !== lastToken) {
        lastToken = session.authToken;
        const msg: AuthMessage = { type: TOKEN_UPDATED, payload: session };
        void browser.runtime.sendMessage(msg).catch(() => {});
        record({
          t: Date.now(),
          ctx: 'content',
          kind: 'session',
          sessionId: session.sessionId,
          hasToken: Boolean(session.authToken),
          userId: session.userId,
        });
      } else if (!session && lastToken !== undefined) {
        lastToken = undefined;
        const msg: AuthMessage = { type: TOKEN_CLEARED };
        void browser.runtime.sendMessage(msg).catch(() => {});
      }
    };

    pushSession();
    // 'storage' events only fire cross-document, so poll for same-page refreshes too.
    const interval = setInterval(pushSession, 5_000);
    window.addEventListener('storage', pushSession);
    window.addEventListener('focus', pushSession);
    window.addEventListener('pagehide', () => clearInterval(interval));

    // Reserve runs in-page (page-context fetch reuses the SPA's same-origin auth).
    const handlers: Record<string, RpcHandler> = {
      [RESERVE_PING]: () => 'pong',
      [RESERVE_METHOD]: async (params, ctx) => {
        const { job, match } = params as { job: HuntJob; match: TripMatch };
        const uuid = extractSessionSafe()?.sessionId;
        const outcome = await executeReserve(job, match, {
          emit: (o: ReserveOutcome) => ctx.emit(RESERVE_STATUS, o),
          ...(uuid ? { uuid } : {}),
        });
        // /payment's route guard gates on booking-store.cartId; seed it here
        // before the SW navigates the tab or the guard bounces back to `/`.
        if (outcome.status === 'reserve_ok' && typeof outcome.cartId === 'number') {
          seedCheckoutCart(outcome.cartId);
        }
        return outcome;
      },
    };
    serveInContentScript(handlers);

    console.debug('[uz] content script attached on', location.href);
  },
});

function extractSessionSafe(): ExtractedSession | null {
  try {
    return extractSession(window.localStorage);
  } catch {
    return null;
  }
}

// Merge cartId into the SPA's booking-store; the page re-fetches the full cart
// from it, so the id alone is enough. Merge to preserve the store's shape.
function seedCheckoutCart(cartId: number): void {
  try {
    const raw = window.sessionStorage.getItem('booking-store');
    const store: Record<string, unknown> = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    store.cartId = cartId;
    window.sessionStorage.setItem('booking-store', JSON.stringify(store));
  } catch {
    // best effort; the SW still opens /payment
  }
}
