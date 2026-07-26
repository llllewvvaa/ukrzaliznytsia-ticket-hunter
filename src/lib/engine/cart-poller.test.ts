import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/api/uz-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/uz-api')>();
  return { ...actual, getCartStatus: vi.fn() };
});

import { getCartStatus } from '@/lib/api/uz-api';
import { pollCart, CartTimeoutError } from './cart-poller';
import type { CartStatusResponse } from '@/lib/models';

const pending = (retry_in: number): CartStatusResponse => ({
  kind: 'pending',
  cart_id: 1,
  title: 'Бронювання',
  description: 'у черзі',
  retry_in,
});
const ready = (): CartStatusResponse => ({
  kind: 'ready',
  cart_id: 1,
  payment_url: 'https://booking.uz.gov.ua/cart/',
});

const noSleep = async (): Promise<void> => {};

beforeEach(() => {
  vi.mocked(getCartStatus).mockReset();
});

describe('pollCart', () => {
  it('returns immediately when the cart is ready', async () => {
    vi.mocked(getCartStatus).mockResolvedValueOnce(ready());
    const res = await pollCart(1, { sleep: noSleep });
    expect(res.kind).toBe('ready');
    expect(res.payment_url).toContain('/cart/');
    expect(vi.mocked(getCartStatus)).toHaveBeenCalledOnce();
  });

  it('keeps polling on 202 and reports retry_in via onPending', async () => {
    vi.mocked(getCartStatus)
      .mockResolvedValueOnce(pending(6))
      .mockResolvedValueOnce(pending(6))
      .mockResolvedValueOnce(ready());
    const seen: number[] = [];

    const res = await pollCart(1, {
      sleep: noSleep,
      now: () => 1_000_000, // frozen clock → never times out
      onPending: (r) => seen.push(r),
    });

    expect(res.kind).toBe('ready');
    expect(seen).toEqual([6, 6]);
    expect(vi.mocked(getCartStatus)).toHaveBeenCalledTimes(3);
  });

  it('throws CartTimeoutError once the budget would be exceeded', async () => {
    vi.mocked(getCartStatus).mockResolvedValue(pending(6));
    let t = 0;
    const sleep = async (ms: number): Promise<void> => {
      t += ms;
    };

    await expect(pollCart(1, { timeoutMs: 10_000, now: () => t, sleep })).rejects.toBeInstanceOf(
      CartTimeoutError,
    );
  });

  it('defaults a missing retry_in to a safe interval', async () => {
    vi.mocked(getCartStatus).mockResolvedValueOnce(pending(0)).mockResolvedValueOnce(ready());
    const seen: number[] = [];
    await pollCart(1, { sleep: noSleep, now: () => 0, onPending: (r) => seen.push(r) });
    expect(seen[0]).toBeGreaterThan(0);
  });
});
