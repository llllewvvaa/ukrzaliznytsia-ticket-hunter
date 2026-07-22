import { browser } from 'wxt/browser';

export const BOOKING_URL = 'https://booking.uz.gov.ua/';
export const BOOKING_MATCH = 'https://booking.uz.gov.ua/*';

export async function findBookingTab() {
  const tabs = await browser.tabs.query({ url: BOOKING_MATCH });
  return tabs[0];
}

export async function ensureBookingTab(): Promise<number> {
  const existing = await findBookingTab();
  if (existing?.id != null) return existing.id;

  // pinned + background: the reserve's content script runs fine unfocused
  const tab = await browser.tabs.create({ url: BOOKING_URL, active: false, pinned: true });
  if (tab.id == null) throw new Error('failed to open booking.uz tab');
  await waitForTabComplete(tab.id);
  return tab.id;
}

function waitForTabComplete(tabId: number, timeoutMs = 20_000): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const cleanup = (): void => {
      clearTimeout(timer);
      browser.tabs.onUpdated.removeListener(onUpdated);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('booking.uz tab load timeout'));
    }, timeoutMs);
    const onUpdated = (id: number, info: { status?: string }): void => {
      if (id === tabId && info.status === 'complete') {
        cleanup();
        resolve();
      }
    };
    browser.tabs.onUpdated.addListener(onUpdated);
    void browser.tabs
      .get(tabId)
      .then((t) => {
        if (t.status === 'complete') {
          cleanup();
          resolve();
        }
      })
      .catch(() => {
        // tab may be gone; the timeout handles it
      });
  });
}

export async function reloadBookingTab(tabId: number): Promise<void> {
  await browser.tabs.reload(tabId);
  await waitForTabComplete(tabId);
}

export async function focusBookingTab(tabId?: number): Promise<void> {
  const id = tabId ?? (await findBookingTab())?.id;
  if (id == null) return;
  const tab = await browser.tabs.update(id, { active: true });
  if (tab?.windowId != null) {
    await browser.windows.update(tab.windowId, { focused: true });
  }
}
