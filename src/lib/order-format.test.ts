import { describe, it, expect } from 'vitest';
import archivedFix from '../../fixtures/orders-archived.json';
import { parseArchivedOrders } from './uz-api';
import {
  hryvnia,
  isReturned,
  orderTotal,
  passengerName,
  seatLabel,
  tripDateTime,
} from './order-format';
import { holdUntilLabel } from './job-format';

const { orders } = parseArchivedOrders(archivedFix);

describe('order-format', () => {
  it('formats kopecks as hryvnia', () => {
    const s = hryvnia(26636);
    expect(s).toContain('₴');
    expect(s).toMatch(/266[.,]36/);
    expect(hryvnia(0)).toMatch(/0[.,]00/);
    expect(hryvnia(undefined)).toMatch(/0[.,]00/);
  });

  it('sums every ticket price for an order total', () => {
    // first archived order: two tickets at 25222 kopecks each
    expect(orderTotal(orders[0]!)).toBe(50444);
    expect(orderTotal(orders[1]!)).toBe(45543);
  });

  it('builds passenger + seat labels from a reservation', () => {
    const res = orders[0]!.tickets[0]!.reservation;
    expect(passengerName(res)).toBe('Олена Прикладна');
    expect(seatLabel(res)).toBe('3 вагон · 21 місце');
  });

  it('flags returned tickets via returned_at', () => {
    expect(isReturned(orders[0]!.tickets[0]!)).toBe(true);
    expect(isReturned(orders[1]!.tickets[0]!)).toBe(false);
  });

  it('renders a non-empty date/time for a unix-seconds value', () => {
    expect(tripDateTime(1781694000)).not.toBe('—');
    expect(tripDateTime(undefined)).toBe('—');
  });
});

describe('holdUntilLabel', () => {
  it('returns empty for missing or already-elapsed deadlines', () => {
    expect(holdUntilLabel(undefined)).toBe('');
    expect(holdUntilLabel(1000, 2000)).toBe(''); // elapsed
  });

  it('prefixes a future deadline with "Заброньовано на"', () => {
    const future = 5_000_000;
    expect(holdUntilLabel(future, 1_000_000)).toMatch(/^Заброньовано на /);
  });
});
