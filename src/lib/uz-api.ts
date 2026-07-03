import type {
  ActiveOrdersResponse,
  ArchivedOrdersResponse,
  CartStatusResponse,
  CreateOrderRequest,
  CreateOrderResponse,
  Pagination,
  Passenger,
  Profile,
  SearchTripsParams,
  SeatHold,
  Station,
  Trip,
  UserOrder,
  UzAuthHeaders,
  Wagon,
} from './models';
import { debugEnabled, recordApiRequest } from './debug';

export const API_BASE = 'https://app.uz.gov.ua/api';

export class UzApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'UzApiError';
  }
}

export class AuthError extends UzApiError {
  constructor(message = 'not_authenticated') {
    super(401, message);
    this.name = 'AuthError';
  }
}

export class RateLimitError extends UzApiError {
  constructor(
    public readonly retryAfterSec: number | undefined,
    message = 'rate_limited',
  ) {
    super(429, message);
    this.name = 'RateLimitError';
  }
}

export class NotDiscoveredError extends Error {
  constructor(endpoint: string) {
    super(`Endpoint not confirmed by discovery: ${endpoint} (see docs/endpoints.md)`);
    this.name = 'NotDiscoveredError';
  }
}

type HeaderProvider = () => Promise<UzAuthHeaders | null>;
type UnauthorizedHandler = () => void | Promise<void>;

let headerProvider: HeaderProvider = async () => null;
let onUnauthorized: UnauthorizedHandler = () => {};

export function configureApi(opts: {
  headers?: HeaderProvider;
  onUnauthorized?: UnauthorizedHandler;
}): void {
  if (opts.headers) headerProvider = opts.headers;
  if (opts.onUnauthorized) onUnauthorized = opts.onUnauthorized;
}

interface RequestOpts {
  method?: 'GET' | 'POST';
  body?: unknown;
  signal?: AbortSignal;
  auth?: boolean;
  retries?: number;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function parseRetryAfter(res: Response): number | undefined {
  const header = res.headers.get('retry-after');
  if (!header) return undefined;
  const seconds = Number(header);
  return Number.isFinite(seconds) ? seconds : undefined;
}

export async function rawRequest(
  path: string,
  opts: RequestOpts = {},
): Promise<Response> {
  const { method = 'GET', body, signal, auth = true, retries = 2 } = opts;

  const headers: Record<string, string> = {};
  if (auth) {
    const authHeaders = await headerProvider();
    if (!authHeaders) throw new AuthError();
    Object.assign(headers, authHeaders);
  } else {
    headers.accept = 'application/json';
  }
  if (body !== undefined) headers['content-type'] = 'application/json';

  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const init: RequestInit = { method, headers };
  if (body !== undefined) init.body = JSON.stringify(body);
  if (signal) init.signal = signal;

  let attempt = 0;
  const started = Date.now();
  for (;;) {
    try {
      const res = await fetch(url, init);
      if (res.status >= 500 && attempt < retries) {
        attempt++;
        await delay(200 * attempt);
        continue;
      }
      if (debugEnabled()) {
        // Clone synchronously so the recorder doesn't race the caller's body read.
        void recordApiRequest({ method, url, reqHeaders: headers, reqBody: body, res: res.clone(), ms: Date.now() - started });
      }
      return res;
    } catch (err) {
      if (attempt < retries) {
        attempt++;
        await delay(200 * attempt);
        continue;
      }
      if (debugEnabled()) {
        void recordApiRequest({ method, url, reqHeaders: headers, reqBody: body, ms: Date.now() - started, error: err });
      }
      throw err;
    }
  }
}

async function requestJson<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const res = await rawRequest(path, opts);

  if (res.status === 401) {
    await onUnauthorized();
    throw new AuthError();
  }
  if (res.status === 429) {
    let message = 'rate_limited';
    try {
      const data = (await res.clone().json()) as { message?: string };
      if (data.message) message = data.message;
    } catch {
      /* ignore */
    }
    throw new RateLimitError(parseRetryAfter(res), message);
  }
  if (!res.ok) {
    throw new UzApiError(res.status, await errorMessageFrom(res));
  }
  return (await res.json()) as T;
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return `HTTP ${res.status}`;
  }
}

async function errorMessageFrom(res: Response): Promise<string> {
  const text = await safeText(res);
  try {
    const data = JSON.parse(text) as { message?: unknown };
    if (typeof data?.message === 'string' && data.message.trim()) return data.message;
  } catch {
    /* not JSON — fall back to the raw text */
  }
  return text;
}

export function parseProfile(raw: unknown): Profile {
  return unwrap(raw) as Profile;
}

export function parsePassengers(raw: unknown): Passenger[] {
  const data = unwrap(raw);
  if (!Array.isArray(data)) throw new UzApiError(200, 'passengers: expected array');
  return data as Passenger[];
}

export function parseStations(raw: unknown): Station[] {
  const data = unwrap(raw);
  if (!Array.isArray(data)) throw new UzApiError(200, 'stations: expected array');
  return data.filter(
    (s): s is Station =>
      typeof s === 'object' &&
      s !== null &&
      typeof (s as Station).id === 'number' &&
      typeof (s as Station).name === 'string',
  );
}

export function parseTrip(raw: unknown): Trip {
  return unwrap(raw) as Trip;
}

export function parseSearchTrips(raw: unknown): Trip[] {
  const data = unwrap(raw) as { direct?: unknown };
  const direct = data?.direct;
  if (!Array.isArray(direct)) {
    throw new UzApiError(200, 'searchTrips: expected { direct: [...] }');
  }
  return direct as Trip[];
}

export function parseCreateOrder(raw: unknown): CreateOrderResponse {
  const data = unwrap(raw) as { cart_id?: number };
  if (typeof data.cart_id !== 'number') {
    throw new UzApiError(200, 'createOrder: missing cart_id');
  }
  return { cart_id: data.cart_id };
}

export function parseCartStatus(status: number, raw: unknown): CartStatusResponse {
  const data = unwrap(raw) as Record<string, unknown>;
  if (status === 202) {
    return {
      kind: 'pending',
      cart_id: Number(data.cart_id),
      title: String(data.title ?? ''),
      description: String(data.description ?? ''),
      retry_in: typeof data.retry_in === 'number' ? data.retry_in : 6,
    };
  }
  // A ready cart is keyed `id` (not `cart_id`) and carries `expire_at` (hold deadline, unix seconds).
  return {
    ...data,
    kind: 'ready',
    cart_id: Number(data.cart_id ?? data.id),
    ...(typeof data.payment_url === 'string' ? { payment_url: data.payment_url } : {}),
    ...(typeof data.expire_at === 'number' ? { expire_at: data.expire_at } : {}),
  };
}

export function parseActiveOrders(raw: unknown): ActiveOrdersResponse {
  const data = (raw ?? {}) as { orders?: unknown; has_archived?: unknown };
  return {
    orders: Array.isArray(data.orders) ? (data.orders as UserOrder[]) : [],
    hasArchived: Boolean(data.has_archived),
  };
}

export function parseArchivedOrders(raw: unknown): ArchivedOrdersResponse {
  const data = (raw ?? {}) as { data?: unknown; meta?: { pagination?: Partial<Pagination> } };
  const pg = data.meta?.pagination ?? {};
  return {
    orders: Array.isArray(data.data) ? (data.data as UserOrder[]) : [],
    pagination: {
      total: Number(pg.total ?? 0),
      count: Number(pg.count ?? 0),
      per_page: Number(pg.per_page ?? 20),
      current_page: Number(pg.current_page ?? 1),
      total_pages: Number(pg.total_pages ?? 1),
    },
  };
}

// Some UZ endpoints wrap payloads in `{ data: ... }`; tolerate both shapes.
function unwrap(raw: unknown): unknown {
  if (
    typeof raw === 'object' &&
    raw !== null &&
    'data' in raw &&
    Object.keys(raw as object).length === 1
  ) {
    return (raw as { data: unknown }).data;
  }
  return raw;
}

export function getProfile(signal?: AbortSignal): Promise<Profile> {
  return requestJson<unknown>('/v2/profile', signal ? { signal } : {}).then(parseProfile);
}

export function getPassengers(signal?: AbortSignal): Promise<Passenger[]> {
  return requestJson<unknown>('/v2/passengers', signal ? { signal } : {}).then(
    parsePassengers,
  );
}

export function getTrip(tripId: number, signal?: AbortSignal): Promise<Trip> {
  return requestJson<unknown>(`/v3/trips/${tripId}`, signal ? { signal } : {}).then(
    parseTrip,
  );
}

export function createOrder(
  req: CreateOrderRequest,
  signal?: AbortSignal,
): Promise<CreateOrderResponse> {
  return requestJson<unknown>('/v4/orders', {
    method: 'POST',
    body: req,
    retries: 0, // reservation POST must never auto-retry
    ...(signal ? { signal } : {}),
  }).then(parseCreateOrder);
}

export function searchStations(query: string, signal?: AbortSignal): Promise<Station[]> {
  const path = `/stations?search=${encodeURIComponent(query)}`;
  return requestJson<unknown>(path, signal ? { signal } : {}).then(parseStations);
}

export function searchTrips(
  params: SearchTripsParams,
  signal?: AbortSignal,
): Promise<Trip[]> {
  const { fromId, toId, date } = params;
  const path =
    `/v3/trips?station_from_id=${fromId}&station_to_id=${toId}` +
    `&with_transfers=0&date=${encodeURIComponent(date)}`;
  return requestJson<unknown>(path, signal ? { signal } : {}).then(parseSearchTrips);
}

export async function holdSeats(
  tripId: number,
  seats: SeatHold[],
  uuid: string,
  signal?: AbortSignal,
): Promise<void> {
  await requestJson<unknown>(`/trips/${tripId}/seats/hold`, {
    method: 'POST',
    body: { seats, uuid },
    retries: 0,
    ...(signal ? { signal } : {}),
  });
}

export function getActiveOrders(signal?: AbortSignal): Promise<ActiveOrdersResponse> {
  return requestJson<unknown>('/v4/orders-with-routes', signal ? { signal } : {}).then(
    parseActiveOrders,
  );
}

export function getArchivedOrders(
  page = 1,
  signal?: AbortSignal,
): Promise<ArchivedOrdersResponse> {
  return requestJson<unknown>(
    `/v2/orders/archived?page=${page}`,
    signal ? { signal } : {},
  ).then(parseArchivedOrders);
}

export async function getCartStatus(
  cartId: number,
  signal?: AbortSignal,
): Promise<CartStatusResponse> {
  const res = await rawRequest(`/v4/carts/${cartId}`, signal ? { signal } : {});
  if (res.status === 401) {
    await onUnauthorized();
    throw new AuthError();
  }
  if (res.status === 429) {
    throw new RateLimitError(parseRetryAfter(res));
  }
  if (res.status !== 200 && res.status !== 202) {
    throw new UzApiError(res.status, await safeText(res));
  }
  return parseCartStatus(res.status, await res.json());
}

// Free seat numbers, tolerant of shape: flat numbers/strings, or objects keyed
// by num/number/seat/seat_number/id.
function seatNumbersFrom(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  const out: number[] = [];
  for (const s of v) {
    let n: number;
    if (typeof s === 'number') n = s;
    else if (typeof s === 'string') n = Number(s);
    else if (s && typeof s === 'object') {
      const o = s as Record<string, unknown>;
      n = Number(o.num ?? o.number ?? o.seat ?? o.seat_number ?? o.id);
    } else n = NaN;
    if (Number.isInteger(n) && n > 0) out.push(n);
  }
  return out;
}

export function parseWagons(raw: unknown): Wagon[] {
  const data = unwrap(raw) as { wagons?: unknown };
  const list = Array.isArray(data?.wagons)
    ? data.wagons
    : Array.isArray(data)
      ? data
      : null;
  if (!list) throw new UzApiError(200, 'wagons-by-class: expected { wagons: [...] }');
  return list.map((w): Wagon => {
    const o = (w ?? {}) as Record<string, unknown>;
    return {
      id: String(o.id ?? ''),
      number: String(o.number ?? ''),
      seats: seatNumbersFrom(o.seats ?? o.places ?? o.free_places),
      free_seats_top: Number(o.free_seats_top ?? 0),
      free_seats_lower: Number(o.free_seats_lower ?? 0),
      price: Number(o.price ?? 0),
      air_conditioner: Boolean(
        o.air_conditioner ?? o.has_conditioner ?? o.with_conditioner ?? o.conditioner,
      ),
      ...(typeof o.mockup_name === 'string' ? { mockup_name: o.mockup_name } : {}),
      ...(typeof o.wagon_key === 'string' ? { wagon_key: o.wagon_key } : {}),
    };
  });
}

export function getWagonsForClass(
  tripId: number,
  classId: string,
  signal?: AbortSignal,
): Promise<Wagon[]> {
  const path = `/v3/trips/${tripId}/wagons-by-class/${encodeURIComponent(classId)}`;
  return requestJson<unknown>(path, signal ? { signal } : {}).then(parseWagons);
}

// TBD: native server-side monitoring; endpoint unknown, callers feature-detect via try/catch.
export function registerMonitor(_params: {
  tripId: number;
  passengerIds: number[];
  coachTypes: string[];
}): Promise<never> {
  return Promise.reject(new NotDiscoveredError('registerMonitor'));
}
