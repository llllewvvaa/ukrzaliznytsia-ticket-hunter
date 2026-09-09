import { createHmac } from 'node:crypto';

export interface InitDataResult {
  ok: boolean;
  reason?: string;
  userId?: number;
  username?: string;
  authDate?: number;
}

export function verifyInitData(
  initData: string,
  botToken: string,
  now: number = Date.now(),
  maxAgeSec = 86_400,
): InitDataResult {
  if (!initData) return { ok: false, reason: 'empty' };
  if (!botToken) return { ok: false, reason: 'no_bot_token' };

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return { ok: false, reason: 'no_hash' };
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(dataCheckString).digest('hex');
  if (expected !== hash) return { ok: false, reason: 'bad_hash' };

  const authDate = Number(params.get('auth_date') ?? 0);
  if (!authDate) return { ok: false, reason: 'no_auth_date' };
  if (now / 1_000 - authDate > maxAgeSec) return { ok: false, reason: 'expired' };

  let userId: number | undefined;
  let username: string | undefined;
  const userRaw = params.get('user');
  if (userRaw) {
    try {
      const user = JSON.parse(userRaw) as { id?: number; username?: string };
      userId = user.id;
      username = user.username;
    } catch {
      return { ok: false, reason: 'bad_user' };
    }
  }

  return { ok: true, userId, username, authDate };
}

export function parseAllowedChats(raw: string | undefined): number[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isFinite(id) && id !== 0);
}

export function isAllowed(userId: number | undefined, allowed: number[]): boolean {
  if (allowed.length === 0) return true;
  return userId != null && allowed.includes(userId);
}
