import { getAuthHeaders, invalidate, registerAuthListener } from '@/lib/auth';
import { configureApi } from '@/lib/uz-api';
import { installNetworkRules } from '@/lib/net-rules';
import { registerKeepAlive } from '@/lib/bridge';
import { handleAlarm, handleControlMessage, restoreActiveJobs } from '@/lib/orchestrator';
import { installReserveDispatcher } from '@/lib/reserve-dispatch';
import { isDebugEventMessage, isJobControlMessage, isQueryMessage } from '@/lib/messages';
import { handleQuery } from '@/lib/query-handler';
import { debugEnabled, recordSW } from '@/lib/debug';
import { initSidePanel } from '@/lib/sidepanel';
import { onboardingSeen, openOnboarding } from '@/lib/onboarding';

export default defineBackground(() => {
  console.debug('[uz] background service worker started', {
    id: browser.runtime.id,
  });

  registerAuthListener();

  configureApi({
    headers: getAuthHeaders,
    onUnauthorized: invalidate,
  });

  // Rewrite Origin/Referer (forbidden headers fetch can't set) for SW requests
  // only, scoped to tabIds:[-1] so the booking.uz tab is untouched.
  void installNetworkRules();

  registerKeepAlive();
  installReserveDispatcher();
  initSidePanel();

  browser.alarms.onAlarm.addListener((alarm) => {
    void handleAlarm(alarm.name);
  });

  browser.runtime.onMessage.addListener((message: unknown) => {
    if (isJobControlMessage(message)) {
      void handleControlMessage(message);
    }
  });

  // Returning a Promise sends its resolved value back as the response.
  browser.runtime.onMessage.addListener((message: unknown) => {
    if (isQueryMessage(message)) {
      return handleQuery(message);
    }
    return undefined;
  });

  browser.runtime.onMessage.addListener((message: unknown) => {
    if (isDebugEventMessage(message)) void recordSW(message.event);
  });

  if (browser.webNavigation) {
    const navFilter = { url: [{ hostEquals: 'booking.uz.gov.ua' }] };
    const onNav =
      (navType: string) =>
      (d: { url: string; frameId: number; transitionType?: string }): void => {
        if (d.frameId !== 0 || !debugEnabled()) return;
        void recordSW({
          t: Date.now(),
          ctx: 'sw',
          kind: 'nav',
          navType,
          to: d.url,
          ...(d.transitionType ? { detail: d.transitionType } : {}),
        });
      };
    browser.webNavigation.onCommitted.addListener(onNav('committed'), navFilter);
    browser.webNavigation.onHistoryStateUpdated.addListener(onNav('history'), navFilter);
  }

  browser.runtime.onInstalled.addListener((details) => {
    console.debug('[uz] onInstalled', details.reason);
    void restoreActiveJobs();
    if (details.reason === 'install') {
      void onboardingSeen().then((seen) => {
        if (!seen) void openOnboarding();
      });
    }
  });

  browser.runtime.onStartup.addListener(() => {
    console.debug('[uz] onStartup');
    void restoreActiveJobs();
  });
});
