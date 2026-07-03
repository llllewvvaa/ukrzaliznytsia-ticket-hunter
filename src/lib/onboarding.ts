import { browser } from 'wxt/browser';
import { BOOKING_URL } from './job-format';

export const ONBOARDING_FLAG = 'ui:onboardingSeen';

export function onboardingUrl(): string {
  return browser.runtime.getURL('/onboarding.html');
}

export async function openOnboarding(): Promise<void> {
  const url = onboardingUrl();
  const existing = await browser.tabs.query({ url });
  const openTab = existing.find((t) => t.id != null);
  if (openTab?.id != null) {
    await browser.tabs.update(openTab.id, { active: true });
    if (openTab.windowId != null) await browser.windows.update(openTab.windowId, { focused: true });
    return;
  }
  await browser.tabs.create({ url, active: true });
}

export async function onboardingSeen(): Promise<boolean> {
  const stored = await browser.storage.local.get(ONBOARDING_FLAG);
  return stored[ONBOARDING_FLAG] === true;
}

export async function markOnboardingSeen(): Promise<void> {
  await browser.storage.local.set({ [ONBOARDING_FLAG]: true });
}

export async function closeOnboardingTab(): Promise<void> {
  try {
    const tab = await browser.tabs.getCurrent();
    if (tab?.id != null) await browser.tabs.remove(tab.id);
  } catch {}
}

// Ends onboarding on booking.uz, where the user logs in so the extension can pick up the session.
export async function openBookingFromOnboarding(): Promise<void> {
  await markOnboardingSeen();
  try {
    const tab = await browser.tabs.getCurrent();
    if (tab?.id != null) {
      await browser.tabs.update(tab.id, { url: BOOKING_URL });
      return;
    }
  } catch {}
  await browser.tabs.create({ url: BOOKING_URL, active: true });
}
