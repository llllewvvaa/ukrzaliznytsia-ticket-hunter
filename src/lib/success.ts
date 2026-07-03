import { browser } from 'wxt/browser';
import { clearJobAlarms } from './scheduler';
import { BOOKING_URL, findBookingTab } from './tab-manager';
import { getJob, patchJob } from './store';
import { SEED_CART } from './messages';
import { log } from './logger';
import type { HuntJob, ReserveOutcome } from './models';

// The cart-ready API carries no payment_url and `/cart/` 404s on hard navigation;
// `/payment` is the SPA route that pays a held cart.
const CHECKOUT_URL = 'https://booking.uz.gov.ua/payment';
const OFFSCREEN_URL = 'offscreen.html';
const SUCCESS_NOTIF_PREFIX = 'uz-success-';

interface OffscreenApi {
  hasDocument?: () => Promise<boolean>;
  createDocument?: (opts: {
    url: string;
    reasons: string[];
    justification: string;
  }) => Promise<void>;
}

function offscreenApi(): OffscreenApi | undefined {
  const g = globalThis as { chrome?: { offscreen?: OffscreenApi } };
  return g.chrome?.offscreen ?? (browser as unknown as { offscreen?: OffscreenApi }).offscreen;
}

export async function ensureOffscreenDocument(): Promise<void> {
  const api = offscreenApi();
  if (!api?.createDocument) return;
  try {
    if (api.hasDocument && (await api.hasDocument())) return;
    await api.createDocument({
      url: OFFSCREEN_URL,
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Play an alert sound when a ticket is reserved.',
    });
  } catch {
    // a document may already exist (race)
  }
}

export async function playAlert(): Promise<void> {
  try {
    await ensureOffscreenDocument();
    await browser.runtime.sendMessage({ type: 'play-sound' });
  } catch {
    // offscreen unavailable (e.g. tests)
  }
}

export async function notifyReserved(job: HuntJob): Promise<void> {
  try {
    await browser.notifications.create(`${SUCCESS_NOTIF_PREFIX}${job.id}`, {
      type: 'basic',
      iconUrl: browser.runtime.getURL('/icon/128.png'),
      title: 'Квиток зарезервовано!',
      message: `${job.name}: завершіть оплату протягом ~15 хв`,
      requireInteraction: true,
      priority: 2,
    });
  } catch {
    // notifications may be unavailable in tests
  }
}

export async function onReserved(
  job: HuntJob,
  outcome: ReserveOutcome,
  tabId?: number,
): Promise<void> {
  await clearJobAlarms(job.id);
  await patchJob(job.id, {
    state: 'reserved',
    reservedAt: Date.now(),
    ...(outcome.cartId != null ? { cartId: outcome.cartId } : {}),
    ...(outcome.paymentUrl ? { paymentUrl: outcome.paymentUrl } : {}),
    ...(outcome.reservedUntil != null ? { reservedUntil: outcome.reservedUntil } : {}),
  });
  await log({
    jobId: job.id,
    endpoint: 'GET /api/v4/carts/{id}',
    outcome: 'reserve_ok',
    detail: `cart ${outcome.cartId ?? '?'} ready`,
  });

  await playAlert();
  await notifyReserved(job);

  // The reserve tab was already seeded inline by the content script.
  await openCheckout(tabId, outcome.paymentUrl);
}

function resolveCheckoutUrl(paymentUrl?: string): string {
  return paymentUrl && /^https?:\/\//.test(paymentUrl) && !/\/cart\/?$/.test(paymentUrl)
    ? paymentUrl
    : CHECKOUT_URL;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function navigateAndFocus(tabId: number, url: string): Promise<boolean> {
  try {
    await browser.tabs.update(tabId, { url, active: true });
    const tab = await browser.tabs.get(tabId);
    if (tab.windowId != null) await browser.windows.update(tab.windowId, { focused: true });
    return true;
  } catch {
    return false;
  }
}

async function openCheckout(tabId?: number, paymentUrl?: string): Promise<void> {
  const url = resolveCheckoutUrl(paymentUrl);
  if (tabId != null && (await navigateAndFocus(tabId, url))) return;
  await browser.tabs.create({ url, active: true });
}

// `/payment` needs booking-store.cartId in the TARGET tab's per-tab sessionStorage,
// so a fresh tab bounces home: reuse a booking.uz tab, seed the id, then navigate it.
export async function openCheckoutForCart(cartId?: number, paymentUrl?: string): Promise<void> {
  const url = resolveCheckoutUrl(paymentUrl);
  let tabId = (await findBookingTab())?.id;
  if (tabId == null) {
    const tab = await browser.tabs.create({ url: BOOKING_URL, active: true });
    tabId = tab.id;
  }
  if (tabId == null) {
    await browser.tabs.create({ url, active: true });
    return;
  }
  if (cartId != null) await seedCartInTab(tabId, cartId);
  if (!(await navigateAndFocus(tabId, url))) await browser.tabs.create({ url, active: true });
}

async function seedCartInTab(tabId: number, cartId: number): Promise<boolean> {
  for (let i = 0; i < 12; i++) {
    try {
      const ok = await browser.tabs.sendMessage(tabId, { type: SEED_CART, cartId });
      if (ok === true) return true;
    } catch {
      // content script not ready yet — retry
    }
    await delay(300);
  }
  return false;
}

export function registerNotificationClick(): void {
  browser.notifications.onClicked.addListener((id: string) => {
    if (!id.startsWith(SUCCESS_NOTIF_PREFIX)) return;
    const jobId = id.slice(SUCCESS_NOTIF_PREFIX.length);
    void (async () => {
      const job = await getJob(jobId);
      await openCheckoutForCart(job?.cartId, job?.paymentUrl);
    })();
  });
}
