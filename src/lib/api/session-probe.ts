// SW-side session pull: reads booking.uz localStorage directly via
// chrome.scripting and reconciles the cached session with it. This covers the
// gaps in the content-script push (5 s poll): tabs opened before install/update
// have no live content script, and a cleared SW cache is only re-pushed after a
// page reload. With the pull, neither needs a reload.
import { browser } from 'wxt/browser';
import { extractSession, storageFromSnapshot, type ExtractedSession } from './auth-extractor';
import { getSession, invalidate, setSession } from './auth';
import { refreshActionIcon } from '@/lib/ui/icon-sync';

const BOOKING_URL_PATTERN = 'https://booking.uz.gov.ua/*';

// Runs inside the booking.uz tab; must stay self-contained (it is serialized).
// localStorage is per-origin, so the default ISOLATED world sees the SPA's data.
function snapshotLocalStorage(): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k) out[k] = localStorage.getItem(k) ?? '';
  }
  return out;
}

// undefined = tab not probeable right now (mid-navigation, no access);
// null = probed, no session in it (logged out).
async function probeTab(tabId: number): Promise<ExtractedSession | null | undefined> {
  try {
    const [res] = await browser.scripting.executeScript({
      target: { tabId },
      func: snapshotLocalStorage,
    });
    if (!res || typeof res.result !== 'object' || res.result === null) return undefined;
    return extractSession(storageFromSnapshot(res.result as Record<string, string>));
  } catch {
    return undefined;
  }
}

export type ProbeDecision =
  { action: 'set'; session: ExtractedSession } | { action: 'invalidate' } | { action: 'keep' };

// Pure: what a probe round means for the cached session. A live tab without a
// session means "logged out", but only trust that when at least one tab was
// actually readable — discarded/navigating tabs say nothing.
export function resolveProbeDecision(
  probedAny: boolean,
  found: ExtractedSession | null,
  cached: boolean,
): ProbeDecision {
  if (found) return { action: 'set', session: found };
  if (probedAny && cached) return { action: 'invalidate' };
  return { action: 'keep' };
}

let inFlight: Promise<boolean> | null = null;

// Probe every open booking.uz tab, reconcile the cached session + badge with
// what the page actually holds, and return whether a session is active.
// Concurrent calls coalesce onto one probe round.
export function syncSessionFromTabs(): Promise<boolean> {
  inFlight ??= doSync().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function doSync(): Promise<boolean> {
  let probedAny = false;
  let found: ExtractedSession | null = null;

  try {
    const tabs = await browser.tabs.query({ url: BOOKING_URL_PATTERN });
    for (const tab of tabs) {
      if (tab.id === undefined || tab.discarded === true) continue;
      const session = await probeTab(tab.id);
      if (session === undefined) continue;
      probedAny = true;
      if (session) {
        found = session;
        break;
      }
    }
  } catch {
    // tabs.query failed — fall through to the cached state
  }

  const cached = await getSession();
  const decision = resolveProbeDecision(probedAny, found, cached !== null);
  if (decision.action === 'set') await setSession(decision.session);
  else if (decision.action === 'invalidate') await invalidate();

  const active =
    decision.action === 'set' ? true : decision.action === 'invalidate' ? false : cached !== null;
  await refreshActionIcon();
  return active;
}
