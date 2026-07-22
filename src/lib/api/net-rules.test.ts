import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fakeBrowser } from 'wxt/testing';
import {
  API_DOMAIN,
  BOOKING_ORIGIN,
  ORIGIN_RULE_ID,
  buildOriginRule,
  installNetworkRules,
} from './net-rules';

/** The test browser has no declarativeNetRequest; we attach/detach a stub. */
type MutableBrowser = { declarativeNetRequest?: unknown };

beforeEach(() => {
  fakeBrowser.reset();
});

afterEach(() => {
  delete (fakeBrowser as unknown as MutableBrowser).declarativeNetRequest;
});

describe('net-rules: buildOriginRule', () => {
  const rule = buildOriginRule();
  const header = (name: string) =>
    (rule.action.requestHeaders ?? []).find((h) => h.header === name);

  it('targets only the UZ API host and SW (non-tab) requests', () => {
    expect(rule.condition.requestDomains).toEqual([API_DOMAIN]);
    // -1 == chrome.tabs.TAB_ID_NONE → requests issued by the service worker.
    expect(rule.condition.tabIds).toEqual([-1]);
  });

  it('rewrites Origin and Referer to the booking SPA', () => {
    expect(rule.action.type).toBe('modifyHeaders');
    expect(header('origin')).toMatchObject({ operation: 'set', value: BOOKING_ORIGIN });
    expect(header('referer')).toMatchObject({ operation: 'set', value: `${BOOKING_ORIGIN}/` });
  });

  it('sets same-site sec-fetch hints', () => {
    expect(header('sec-fetch-site')?.value).toBe('same-site');
    expect(header('sec-fetch-mode')?.value).toBe('cors');
    expect(header('sec-fetch-dest')?.value).toBe('empty');
  });

  it('never touches auth/session headers (those stay in buildHeaders)', () => {
    const names = (rule.action.requestHeaders ?? []).map((h) => h.header);
    expect(names).not.toContain('authorization');
    expect(names).not.toContain('x-session-id');
    expect(names).not.toContain('x-user-agent');
  });

  it('uses a stable id so re-installs replace (not duplicate) the rule', () => {
    expect(rule.id).toBe(ORIGIN_RULE_ID);
  });
});

describe('net-rules: installNetworkRules', () => {
  it('replaces the prior rule and adds the origin rule (session-scoped)', async () => {
    const updateSessionRules = vi.fn().mockResolvedValue(undefined);
    (fakeBrowser as unknown as MutableBrowser).declarativeNetRequest = { updateSessionRules };

    await installNetworkRules();

    expect(updateSessionRules).toHaveBeenCalledTimes(1);
    expect(updateSessionRules).toHaveBeenCalledWith(
      expect.objectContaining({
        removeRuleIds: [ORIGIN_RULE_ID],
        addRules: [
          expect.objectContaining({
            id: ORIGIN_RULE_ID,
            condition: expect.objectContaining({
              requestDomains: [API_DOMAIN],
              tabIds: [-1],
            }),
          }),
        ],
      }),
    );
  });

  it('is a no-op when declarativeNetRequest is unavailable', async () => {
    (fakeBrowser as unknown as MutableBrowser).declarativeNetRequest = undefined;
    await expect(installNetworkRules()).resolves.toBeUndefined();
  });

  it('swallows API failures so SW startup never rejects', async () => {
    const updateSessionRules = vi.fn().mockRejectedValue(new Error('boom'));
    (fakeBrowser as unknown as MutableBrowser).declarativeNetRequest = { updateSessionRules };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(installNetworkRules()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });
});
