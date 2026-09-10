import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { isAllowed, parseAllowedChats, verifyInitData } from './auth.js';

const TOKEN = '123456:test-token';

function signedInitData(payload: Record<string, string>, token = TOKEN): string {
  const dataCheckString = Object.entries(payload)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = createHmac('sha256', secret).update(dataCheckString).digest('hex');
  const params = new URLSearchParams(payload);
  params.set('hash', hash);
  return params.toString();
}

describe('verifyInitData', () => {
  const authDate = 1_800_000_000;
  const now = authDate * 1_000 + 1_000;

  it('accepts data signed with the bot token', () => {
    const initData = signedInitData({
      auth_date: String(authDate),
      user: JSON.stringify({ id: 42, username: 'tester' }),
    });
    expect(verifyInitData(initData, TOKEN, now)).toMatchObject({ ok: true, userId: 42, username: 'tester' });
  });

  it('rejects a tampered payload', () => {
    const initData = signedInitData({ auth_date: String(authDate), user: '{"id":42}' });
    const tampered = initData.replace('%22id%22%3A42', '%22id%22%3A43');
    expect(verifyInitData(tampered, TOKEN, now).ok).toBe(false);
  });

  it('rejects a signature from another token', () => {
    const initData = signedInitData({ auth_date: String(authDate) }, 'other:token');
    expect(verifyInitData(initData, TOKEN, now)).toMatchObject({ ok: false, reason: 'bad_hash' });
  });

  it('rejects stale data', () => {
    const initData = signedInitData({ auth_date: String(authDate) });
    expect(verifyInitData(initData, TOKEN, now + 90_000_000, 86_400)).toMatchObject({ ok: false, reason: 'expired' });
  });

  it('refuses to run without a bot token', () => {
    expect(verifyInitData('x=1', '', now)).toMatchObject({ ok: false, reason: 'no_bot_token' });
  });
});

describe('chat whitelist', () => {
  it('parses a comma separated list', () => {
    expect(parseAllowedChats('10, 20 ,x,0')).toEqual([10, 20]);
  });

  it('allows everyone when the list is empty', () => {
    expect(isAllowed(1, [])).toBe(true);
  });

  it('allows only listed users otherwise', () => {
    expect(isAllowed(10, [10, 20])).toBe(true);
    expect(isAllowed(11, [10, 20])).toBe(false);
    expect(isAllowed(undefined, [10])).toBe(false);
  });
});

describe('failure throttle', () => {
  it('blocks an address after the limit inside the window', async () => {
    const { FAILURE_LIMIT, isBlocked, recordFailure } = await import('./auth.js');
    const windows = new Map();
    for (let i = 0; i < FAILURE_LIMIT; i += 1) recordFailure(windows, '1.2.3.4', 1_000);
    expect(isBlocked(windows, '1.2.3.4', 2_000)).toBe(true);
    expect(isBlocked(windows, '5.6.7.8', 2_000)).toBe(false);
  });

  it('forgets an address once the window passes', async () => {
    const { FAILURE_LIMIT, FAILURE_WINDOW_MS, isBlocked, recordFailure } = await import('./auth.js');
    const windows = new Map();
    for (let i = 0; i < FAILURE_LIMIT; i += 1) recordFailure(windows, '1.2.3.4', 1_000);
    expect(isBlocked(windows, '1.2.3.4', 1_000 + FAILURE_WINDOW_MS + 1)).toBe(false);
  });

  it('expires init data after twelve hours by default', async () => {
    const { verifyInitData } = await import('./auth.js');
    const { createHmac } = await import('node:crypto');
    const payload = { auth_date: '1800000000' };
    const dcs = 'auth_date=1800000000';
    const secret = createHmac('sha256', 'WebAppData').update(TOKEN).digest();
    const hash = createHmac('sha256', secret).update(dcs).digest('hex');
    const initData = new URLSearchParams({ ...payload, hash }).toString();
    expect(verifyInitData(initData, TOKEN, 1_800_000_000_000 + 11 * 3_600_000).ok).toBe(true);
    expect(verifyInitData(initData, TOKEN, 1_800_000_000_000 + 13 * 3_600_000).ok).toBe(false);
  });
});
