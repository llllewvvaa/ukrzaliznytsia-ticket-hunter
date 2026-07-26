import { query } from '@/lib/messages';

// Reserved seats sit in the UZ cart for ~15 min — send the user straight to checkout.
export function openCheckout(cartId: number | undefined, paymentUrl: string | undefined): void {
  void query('openCheckout', { cartId, paymentUrl });
}
