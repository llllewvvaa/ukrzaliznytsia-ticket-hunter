import { browser, type Browser } from 'wxt/browser';

export const ORIGIN_RULE_ID = 1;
export const BOOKING_ORIGIN = 'https://booking.uz.gov.ua';
export const API_DOMAIN = 'app.uz.gov.ua';

// Origin/Referer are forbidden headers fetch can't set, so rewrite them on the
// wire; scoped to SW-only requests (tabIds:[-1]) so the booking.uz tab is untouched.
export function buildOriginRule(): Browser.declarativeNetRequest.Rule {
  return {
    id: ORIGIN_RULE_ID,
    priority: 1,
    action: {
      type: 'modifyHeaders',
      requestHeaders: [
        { header: 'origin', operation: 'set', value: BOOKING_ORIGIN },
        { header: 'referer', operation: 'set', value: `${BOOKING_ORIGIN}/` },
        { header: 'sec-fetch-site', operation: 'set', value: 'same-site' },
        { header: 'sec-fetch-mode', operation: 'set', value: 'cors' },
        { header: 'sec-fetch-dest', operation: 'set', value: 'empty' },
      ],
    },
    condition: {
      requestDomains: [API_DOMAIN],
      tabIds: [-1],
    },
  };
}

// tabIds scoping only applies to session rules, so install via updateSessionRules.
export async function installNetworkRules(): Promise<void> {
  const dnr = browser.declarativeNetRequest;
  if (!dnr?.updateSessionRules) {
    console.debug('[uz] declarativeNetRequest unavailable; skipping header rules');
    return;
  }
  try {
    await dnr.updateSessionRules({
      removeRuleIds: [ORIGIN_RULE_ID],
      addRules: [buildOriginRule()],
    });
    console.debug('[uz] origin/referer header rules installed');
  } catch (err) {
    console.warn('[uz] failed to install header rules', err);
  }
}
