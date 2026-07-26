import { describe, it, expect, beforeEach, vi } from 'vitest';
import profileFix from '../../../fixtures/profile.json';
import passengersFix from '../../../fixtures/passengers.json';
import tripFix from '../../../fixtures/trip-3000001.json';
import cart202Fix from '../../../fixtures/cart-pending-202.json';
import order429Fix from '../../../fixtures/create-order-429.json';
import orderPayloadFix from '../../../fixtures/create-order-payload.json';
import stationsFix from '../../../fixtures/stations.json';
import searchFix from '../../../fixtures/search.json';
import cartReadyFix from '../../../fixtures/cart-ready.json';
import ordersActiveFix from '../../../fixtures/orders-active.json';
import ordersArchivedFix from '../../../fixtures/orders-archived.json';
import {
  parseProfile,
  parsePassengers,
  parseStations,
  parseTrip,
  parseSearchTrips,
  parseCartStatus,
  parseCreateOrder,
  parseActiveOrders,
  parseArchivedOrders,
  configureApi,
  getProfile,
  createOrder,
  getCartStatus,
  searchStations,
  searchTrips,
  holdSeats,
  getActiveOrders,
  getArchivedOrders,
  AuthError,
  RateLimitError,
  API_BASE,
} from './uz-api';
import type { CreateOrderRequest, UzAuthHeaders } from '@/lib/models';

const FAKE_HEADERS: UzAuthHeaders = {
  Authorization: 'Bearer test.jwt.token',
  'x-session-id': '00000000-0000-4000-8000-000000000000',
  'x-user-agent': 'UZ/2 Web/1 User/1000001',
  'x-client-locale': 'uk',
  accept: 'application/json',
};

function jsonResponse(status: number, body: unknown, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

describe('uz-api parsers (fixtures)', () => {
  it('parses profile', () => {
    const p = parseProfile(profileFix);
    expect(p.id).toBe(1000001);
    expect(p.passenger.id).toBe(2000001);
    expect(p.passenger.first_name).toBe('Іван');
  });

  it('parses passengers array', () => {
    const list = parsePassengers(passengersFix);
    expect(list).toHaveLength(3);
    expect(list[0]?.id).toBe(2000001);
    expect(list[1]?.first_name).toBe('Олена');
  });

  it('parses trip with wagon classes + monitoring', () => {
    const t = parseTrip(tripFix);
    expect(t.id).toBe(3000001);
    expect(t.train.number).toBe('057К');
    expect(t.train.wagon_classes[0]?.id).toBe('П');
    expect(t.train.wagon_classes[0]?.free_seats).toBe(3);
    expect(t.monitoring.auto_purchase).toBe(true);
    expect(t.max_passengers_count).toBe(4);
  });

  it('parses a 202 cart as pending with retry_in', () => {
    const c = parseCartStatus(202, cart202Fix);
    expect(c.kind).toBe('pending');
    if (c.kind === 'pending') {
      expect(c.cart_id).toBe(111535997);
      expect(c.retry_in).toBe(6);
      expect(c.title).toContain('Бронювання');
    }
  });

  it('parses a 200 cart as ready with payment_url', () => {
    const c = parseCartStatus(200, { cart_id: 5, payment_url: 'https://x/pay' });
    expect(c.kind).toBe('ready');
    if (c.kind === 'ready') {
      expect(c.cart_id).toBe(5);
      expect(c.payment_url).toBe('https://x/pay');
    }
  });

  it('parses create-order response', () => {
    expect(parseCreateOrder({ cart_id: 42 })).toEqual({ cart_id: 42 });
    expect(() => parseCreateOrder({})).toThrow();
  });

  it('parses a ready cart keyed `id` with the expire_at hold deadline', () => {
    const c = parseCartStatus(200, cartReadyFix);
    expect(c.kind).toBe('ready');
    if (c.kind === 'ready') {
      expect(c.cart_id).toBe(111649120); // falls back to `id` when no cart_id
      expect(c.expire_at).toBe(1782826857);
    }
  });

  it('parses active orders (orders + has_archived)', () => {
    const res = parseActiveOrders(ordersActiveFix);
    expect(res.orders).toEqual([]);
    expect(res.hasArchived).toBe(true);
  });

  it('parses archived orders with pagination + ticket reservations', () => {
    const res = parseArchivedOrders(ordersArchivedFix);
    expect(res.orders).toHaveLength(2);
    expect(res.pagination.total).toBe(17);
    expect(res.pagination.current_page).toBe(1);
    const first = res.orders[0]!;
    expect(first.train.number).toBe('775П');
    expect(first.tickets[0]?.reservation.seat_number).toBe('21');
    expect(first.tickets[0]?.reservation.price).toBe(25222);
    expect(first.tickets[1]?.returned_at).toBe(1781689356);
  });

  it('tolerates an empty/malformed archived payload', () => {
    const res = parseArchivedOrders({});
    expect(res.orders).toEqual([]);
    expect(res.pagination.total_pages).toBe(1);
  });

  it('parses the stations autocomplete array', () => {
    const stations = parseStations(stationsFix);
    expect(stations).toHaveLength(10);
    expect(stations[0]).toEqual({ id: 2204450, name: 'Суми' });
    expect(stations.every((s) => typeof s.id === 'number' && typeof s.name === 'string')).toBe(
      true,
    );
  });

  it('drops malformed station entries', () => {
    const stations = parseStations([
      { id: 1, name: 'Київ-Пас' },
      { id: 'x', name: 'bad id' },
      { name: 'no id' },
      null,
    ]);
    expect(stations).toEqual([{ id: 1, name: 'Київ-Пас' }]);
  });

  it('parses the search-trips payload, returning the direct trips', () => {
    const trips = parseSearchTrips(searchFix);
    expect(trips).toHaveLength(3);
    expect(trips[0]?.train.number).toBe('021О');
    expect(trips[1]?.train.number).toBe('715К');
    expect(trips[1]?.train.wagon_classes.find((w) => w.id === 'С1')?.free_seats).toBe(32);
  });

  it('throws when search-trips payload lacks a direct array', () => {
    expect(() => parseSearchTrips({ station_from: 'a', station_to: 'b' })).toThrow();
    expect(() => parseSearchTrips([])).toThrow();
  });
});

describe('uz-api request interceptors', () => {
  beforeEach(() => {
    configureApi({ headers: async () => FAKE_HEADERS, onUnauthorized: () => {} });
  });

  it('sends auth headers and returns parsed JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, profileFix));
    vi.stubGlobal('fetch', fetchMock);

    const profile = await getProfile();
    expect(profile.id).toBe(1000001);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${API_BASE}/v2/profile`);
    expect((init.headers as Record<string, string>)['x-session-id']).toBe(
      FAKE_HEADERS['x-session-id'],
    );
    vi.unstubAllGlobals();
  });

  it('throws AuthError (and invalidates) on 401', async () => {
    const onUnauthorized = vi.fn();
    configureApi({ headers: async () => FAKE_HEADERS, onUnauthorized });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, { message: 'no' })));

    await expect(getProfile()).rejects.toBeInstanceOf(AuthError);
    expect(onUnauthorized).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it('throws AuthError without fetching when not authenticated', async () => {
    configureApi({ headers: async () => null });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(getProfile()).rejects.toBeInstanceOf(AuthError);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('maps 429 to RateLimitError carrying the server message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(429, order429Fix, { 'retry-after': '30' })),
    );

    const err = await createOrder(orderPayloadFix as CreateOrderRequest).catch((e) => e);
    expect(err).toBeInstanceOf(RateLimitError);
    expect((err as RateLimitError).retryAfterSec).toBe(30);
    expect((err as RateLimitError).message).toContain('Забагато спроб');
    vi.unstubAllGlobals();
  });

  it('createOrder returns cart_id on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { cart_id: 999 })));
    const res = await createOrder(orderPayloadFix as CreateOrderRequest);
    expect(res.cart_id).toBe(999);
    vi.unstubAllGlobals();
  });

  it('searchStations hits /stations?search=<q> and parses the array', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, stationsFix));
    vi.stubGlobal('fetch', fetchMock);

    const stations = await searchStations('су');
    expect(stations[0]?.name).toBe('Суми');

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe(`${API_BASE}/stations?search=${encodeURIComponent('су')}`);
    vi.unstubAllGlobals();
  });

  it('searchTrips builds /v3/trips?station_from_id=...&with_transfers=0&date= and parses direct', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, searchFix));
    vi.stubGlobal('fetch', fetchMock);

    const trips = await searchTrips({ fromId: 2200001, toId: 2218000, date: '2026-07-10' });
    expect(trips).toHaveLength(3);
    expect(trips[0]?.train.number).toBe('021О');

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe(
      `${API_BASE}/v3/trips?station_from_id=2200001&station_to_id=2218000&with_transfers=0&date=${encodeURIComponent(
        '2026-07-10',
      )}`,
    );
    vi.unstubAllGlobals();
  });

  it('holdSeats POSTs /trips/{id}/seats/hold with seats + uuid', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await holdSeats(11287381, [{ wagon_number: '3', place: 20 }], 'sess-uuid');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${API_BASE}/trips/11287381/seats/hold`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      seats: [{ wagon_number: '3', place: 20 }],
      uuid: 'sess-uuid',
    });
    vi.unstubAllGlobals();
  });

  it('getActiveOrders hits /v4/orders-with-routes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, ordersActiveFix));
    vi.stubGlobal('fetch', fetchMock);

    const res = await getActiveOrders();
    expect(res.hasArchived).toBe(true);
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe(`${API_BASE}/v4/orders-with-routes`);
    vi.unstubAllGlobals();
  });

  it('getArchivedOrders builds /v2/orders/archived?page= and parses it', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, ordersArchivedFix));
    vi.stubGlobal('fetch', fetchMock);

    const res = await getArchivedOrders(2);
    expect(res.orders).toHaveLength(2);
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe(`${API_BASE}/v2/orders/archived?page=2`);
    vi.unstubAllGlobals();
  });

  it('getCartStatus distinguishes 202 pending from 200 ready', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(202, cart202Fix)));
    const pending = await getCartStatus(111535997);
    expect(pending.kind).toBe('pending');

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(jsonResponse(200, { cart_id: 111535997, payment_url: 'https://x' })),
    );
    const ready = await getCartStatus(111535997);
    expect(ready.kind).toBe('ready');
    vi.unstubAllGlobals();
  });
});
