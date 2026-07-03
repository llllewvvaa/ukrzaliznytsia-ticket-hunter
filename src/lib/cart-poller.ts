import { getCartStatus } from './uz-api';
import type { CartStatusResponse } from './models';

export const CART_TIMEOUT_MS = 5 * 60_000;
// Fallback wait when the server omits `retry_in`.
export const DEFAULT_RETRY_IN_SEC = 6;

export class CartTimeoutError extends Error {
  constructor(public readonly cartId: number) {
    super(`cart_timeout: ${cartId}`);
    this.name = 'CartTimeoutError';
  }
}

export interface CartPollOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  onPending?: (retryInSec: number, status: CartStatusResponse) => void;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// GET /carts/{id} returns 202 {retry_in} until 200 (ready); poll honoring retry_in until the timeout.
export async function pollCart(
  cartId: number,
  opts: CartPollOptions = {},
): Promise<Extract<CartStatusResponse, { kind: 'ready' }>> {
  const timeoutMs = opts.timeoutMs ?? CART_TIMEOUT_MS;
  const now = opts.now ?? (() => Date.now());
  const sleep = opts.sleep ?? defaultSleep;
  const deadline = now() + timeoutMs;

  for (;;) {
    const status = await getCartStatus(cartId, opts.signal);
    if (status.kind === 'ready') return status;

    const retryIn = status.retry_in > 0 ? status.retry_in : DEFAULT_RETRY_IN_SEC;
    opts.onPending?.(retryIn, status);

    const waitMs = retryIn * 1_000;
    if (now() + waitMs > deadline) {
      throw new CartTimeoutError(cartId);
    }
    await sleep(waitMs);
  }
}
