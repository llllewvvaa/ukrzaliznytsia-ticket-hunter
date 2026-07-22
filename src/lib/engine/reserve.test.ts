import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/api/uz-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/uz-api')>();
  return {
    ...actual,
    getWagonsForClass: vi.fn(),
    getPassengers: vi.fn(),
    createOrder: vi.fn(),
    holdSeats: vi.fn(),
  };
});
vi.mock('./cart-poller', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./cart-poller')>();
  return { ...actual, pollCart: vi.fn() };
});

import {
  getWagonsForClass,
  getPassengers,
  createOrder,
  holdSeats,
  RateLimitError,
} from '@/lib/api/uz-api';
import { pollCart, CartTimeoutError } from './cart-poller';
import { buildReservations, executeReserve } from './reserve';
import type { HuntJob, Passenger, ReserveOutcome, Trip, Wagon } from '@/lib/models';
import type { TripMatch } from './orchestrator';

function passenger(id: number, first: string, last: string): Passenger {
  return {
    id,
    first_name: first,
    last_name: last,
    ticket_type: 0,
    privilege_id: null,
    privilege_data: null,
    privilege: null,
    photo: null,
    main: false,
    phone: null,
    is_share_user: false,
    birthday: null,
    gender: null,
    is_verified: true,
    is_in_iron_km_program: false,
    iron_km_distance_left: 0,
    iron_km_trips_left: 0,
  };
}

function wagon(id: string, seats: number[]): Wagon {
  return {
    id,
    number: '5',
    seats,
    free_seats_top: seats.filter((s) => s % 2 === 0).length,
    free_seats_lower: seats.filter((s) => s % 2 === 1).length,
    price: 1000,
    air_conditioner: false,
    mockup_name: 'Купейний вагон 36 місць',
  };
}

const trip = { id: 3000001, train: { number: '057К' } } as unknown as Trip;
const match: TripMatch = {
  trip,
  wagonClass: { id: 'К', name: 'Купе', free_seats: 9, price: 1000, amenities: [] },
};

function makeJob(over: Partial<HuntJob> = {}): HuntJob {
  return {
    id: 'r1',
    name: 'Kyiv → Lviv',
    state: 'reserving',
    mode: 'monitor',
    from: { id: 1, name: 'A' },
    to: { id: 2, name: 'B' },
    date: '2026-07-19',
    preferredTrains: [],
    coachTypes: [],
    passengerIds: [1],
    bedding: true,
    attempts: 0,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

beforeEach(() => {
  vi.mocked(getWagonsForClass).mockReset();
  vi.mocked(getPassengers).mockReset();
  vi.mocked(createOrder).mockReset();
  vi.mocked(holdSeats).mockReset();
  vi.mocked(holdSeats).mockResolvedValue(undefined);
  vi.mocked(pollCart).mockReset();
});

describe('buildReservations', () => {
  it('maps passengers to seats and adds bedding when enabled', () => {
    const res = buildReservations(
      [passenger(1, 'Ivan', 'T'), passenger(2, 'Olena', 'P')],
      [1, 2],
      'enc-wagon',
      [28, 25],
      true,
    );
    expect(res).toHaveLength(2);
    expect(res[0]).toMatchObject({
      passenger_id: 1,
      seat_number: 28,
      first_name: 'Ivan',
      wagon_id: 'enc-wagon',
    });
    expect(res[0]?.services[0]?.id).toBe('bedding');
    expect(res[1]?.services[0]?.value).toBe(true);
  });

  it('omits services when bedding is off', () => {
    const res = buildReservations([passenger(1, 'A', 'B')], [1], 'w', [10], false);
    expect(res[0]?.services).toEqual([]);
  });
});

describe('executeReserve', () => {
  it('reserves successfully and emits progress', async () => {
    vi.mocked(getWagonsForClass).mockResolvedValue([wagon('enc', [10, 12, 8])]);
    vi.mocked(getPassengers).mockResolvedValue([passenger(1, 'Ivan', 'T')]);
    vi.mocked(createOrder).mockResolvedValue({ cart_id: 777 });
    vi.mocked(pollCart).mockResolvedValue({
      kind: 'ready',
      cart_id: 777,
      payment_url: 'https://booking.uz.gov.ua/cart/',
    });

    const emitted: ReserveOutcome[] = [];
    const outcome = await executeReserve(makeJob(), match, {
      emit: (o) => emitted.push(o),
    });

    expect(outcome.status).toBe('reserve_ok');
    expect(outcome.cartId).toBe(777);
    expect(outcome.paymentUrl).toContain('/cart/');
    expect(emitted.map((e) => e.status)).toContain('order_enqueued');
    const reservations = vi.mocked(createOrder).mock.calls[0]![0].reservations;
    expect(reservations[0]?.wagon_id).toBe('enc');
    expect(reservations[0]?.seat_number).toBe(8);
  });

  it('holds the chosen seats (plain wagon number + uuid) before ordering', async () => {
    vi.mocked(getWagonsForClass).mockResolvedValue([wagon('enc', [10, 12, 8])]);
    vi.mocked(getPassengers).mockResolvedValue([passenger(1, 'Ivan', 'T')]);
    vi.mocked(createOrder).mockResolvedValue({ cart_id: 1 });
    vi.mocked(pollCart).mockResolvedValue({ kind: 'ready', cart_id: 1 });

    await executeReserve(makeJob(), match, { uuid: 'sess-uuid' });

    expect(vi.mocked(holdSeats)).toHaveBeenCalledWith(
      3000001,
      [{ wagon_number: '5', place: 8 }],
      'sess-uuid',
    );
    // hold must precede the order
    expect(vi.mocked(holdSeats).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(createOrder).mock.invocationCallOrder[0]!,
    );
  });

  it('skips the hold step when no uuid is provided', async () => {
    vi.mocked(getWagonsForClass).mockResolvedValue([wagon('enc', [10])]);
    vi.mocked(getPassengers).mockResolvedValue([passenger(1, 'A', 'B')]);
    vi.mocked(createOrder).mockResolvedValue({ cart_id: 1 });
    vi.mocked(pollCart).mockResolvedValue({ kind: 'ready', cart_id: 1 });

    await executeReserve(makeJob(), match);
    expect(vi.mocked(holdSeats)).not.toHaveBeenCalled();
  });

  it('propagates reservedUntil from the ready cart expire_at (sec → ms)', async () => {
    vi.mocked(getWagonsForClass).mockResolvedValue([wagon('enc', [10])]);
    vi.mocked(getPassengers).mockResolvedValue([passenger(1, 'A', 'B')]);
    vi.mocked(createOrder).mockResolvedValue({ cart_id: 9 });
    vi.mocked(pollCart).mockResolvedValue({ kind: 'ready', cart_id: 9, expire_at: 1782826857 });

    const outcome = await executeReserve(makeJob(), match, { uuid: 'u' });
    expect(outcome.status).toBe('reserve_ok');
    expect(outcome.reservedUntil).toBe(1782826857 * 1000);
  });

  it('maps a 429 from the hold step to rate_limited (before ordering)', async () => {
    vi.mocked(getWagonsForClass).mockResolvedValue([wagon('enc', [10])]);
    vi.mocked(holdSeats).mockRejectedValue(new RateLimitError(30));

    const outcome = await executeReserve(makeJob(), match, { uuid: 'u' });
    expect(outcome.status).toBe('rate_limited');
    expect(outcome.retryInSec).toBe(30);
    expect(vi.mocked(createOrder)).not.toHaveBeenCalled();
  });

  it('maps a wagons-by-class failure to reserve_fail (not captcha)', async () => {
    vi.mocked(getWagonsForClass).mockRejectedValue(new Error('boom'));
    const outcome = await executeReserve(makeJob(), match);
    expect(outcome).toMatchObject({ status: 'reserve_fail', detail: 'boom' });
    expect(vi.mocked(createOrder)).not.toHaveBeenCalled();
  });

  it('maps a 429 on order to rate_limited', async () => {
    vi.mocked(getWagonsForClass).mockResolvedValue([wagon('enc', [10])]);
    vi.mocked(getPassengers).mockResolvedValue([passenger(1, 'A', 'B')]);
    vi.mocked(createOrder).mockRejectedValue(new RateLimitError(45));

    const outcome = await executeReserve(makeJob(), match);
    expect(outcome.status).toBe('rate_limited');
    expect(outcome.retryInSec).toBe(45);
  });

  it('fails with no_seats when nothing is available', async () => {
    vi.mocked(getWagonsForClass).mockResolvedValue([]);
    const outcome = await executeReserve(makeJob({ passengerIds: [1, 2] }), match);
    expect(outcome.status).toBe('reserve_fail');
    expect(outcome.detail).toMatch(/^no_seats\b/);
  });

  it('maps a cart timeout to reserve_fail cart_timeout', async () => {
    vi.mocked(getWagonsForClass).mockResolvedValue([wagon('enc', [10])]);
    vi.mocked(getPassengers).mockResolvedValue([passenger(1, 'A', 'B')]);
    vi.mocked(createOrder).mockResolvedValue({ cart_id: 5 });
    vi.mocked(pollCart).mockRejectedValue(new CartTimeoutError(5));

    const outcome = await executeReserve(makeJob(), match);
    expect(outcome).toMatchObject({ status: 'reserve_fail', detail: 'cart_timeout', cartId: 5 });
  });
});
