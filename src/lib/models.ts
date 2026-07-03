export type JobState =
  | 'idle'
  | 'scheduled'
  | 'hunting'
  | 'reserving'
  | 'paused'
  | 'reserved'
  | 'failed'
  | 'cancelled';

export type JobMode = 'monitor' | 'scheduled' | 'native';

export type PauseReason =
  | 'user'
  | 'not_authenticated'
  | 'captcha'
  | 'rate_limited';

export interface Station {
  id: number;
  name: string;
}

export interface Passenger {
  id: number;
  first_name: string;
  last_name: string;
  ticket_type: number;
  privilege_id: number | null;
  privilege_data: Record<string, unknown> | null;
  privilege: unknown | null;
  photo: string | null;
  main: boolean;
  phone: string | null;
  is_share_user: boolean;
  birthday: string | null;
  gender: number | null;
  is_verified: boolean;
  is_in_iron_km_program: boolean;
  iron_km_distance_left: number;
  iron_km_trips_left: number;
}

export interface Profile {
  id: number;
  type: number;
  phone: string;
  email: string;
  passenger: Passenger;
}

export type CoachType = 'Л' | 'К' | 'П' | 'С1' | 'С2';

export interface WagonClassSummary {
  id: CoachType | string;
  name: string;
  free_seats: number;
  price: number; // kopecks
  amenities: string[];
}

export interface RoutePoint {
  station: Station;
  arrive_at: number;
  depart_at: number;
}

export interface Trip {
  id: number;
  depart_at: number; // unix sec
  arrive_at: number;
  station_from: Station;
  station_to: Station;
  train: {
    id: number;
    number: string;
    type: number;
    station_from: string;
    station_to: string;
    wagon_classes: WagonClassSummary[];
  };
  route_points: RoutePoint[];
  monitoring: { allowed: boolean; auto_purchase: boolean };
  seat_hold_enabled: boolean;
  max_passengers_count: number;
}

export interface Wagon {
  id: string; // encrypted blob, POSTed verbatim as reservations[].wagon_id
  number: string; // plain coach number, used as wagon_number in seat holds
  seats: number[]; // odd = lower berth, even = upper
  free_seats_top: number;
  free_seats_lower: number;
  price: number; // kopecks
  air_conditioner: boolean;
  mockup_name?: string;
  wagon_key?: string;
}

export interface SeatPrefs {
  berth?: 'lower' | 'upper'; // lower = odd, upper = even
  adjacent?: boolean;
  avoidToilet?: boolean;
  airConditioned?: boolean;
}

export interface HuntJob {
  id: string;
  name: string;
  state: JobState;
  mode: JobMode;
  from: Station;
  to: Station;
  date: string; // YYYY-MM-DD
  preferredTrains: string[]; // [] = any
  coachTypes: Array<CoachType | string>; // [] = any
  passengerIds: number[];
  bedding: boolean;
  seatPrefs?: SeatPrefs;
  manualSeats?: { wagonNumber: string; seats: number[] };

  pollIntervalMs?: number;
  startAt?: number; // ms epoch
  sprintIntervalMs?: number;

  maxAttempts?: number;
  attempts: number;
  createdAt: number;
  updatedAt: number;

  lastAttemptAt?: number;
  pauseReason?: PauseReason;
  pausedUntil?: number; // backoff target (ms)
  cartId?: number;
  reservedAt?: number;
  reservedUntil?: number; // ms epoch, cart.expire_at
  paymentUrl?: string;
  lastError?: string;
  relaxHint?: string[];
  lastMatch?: MatchRef;
}

export const ACTIVE_STATES: readonly JobState[] = [
  'scheduled',
  'hunting',
  'reserving',
];

export type LogOutcome =
  | 'no_match'
  | 'matched'
  | 'order_enqueued'
  | 'cart_pending'
  | 'reserve_ok'
  | 'reserve_fail'
  | 'rate_limited'
  | 'auth_missing'
  | 'captcha'
  | 'paused'
  | 'resumed'
  | 'info'
  | 'error';

export interface LogEntry {
  jobId: string;
  ts: number;
  endpoint: string;
  httpStatus?: number;
  outcome: LogOutcome;
  detail?: string; // short, no PII
}

export interface ReservationService {
  id: 'bedding' | string;
  title: string;
  details: unknown;
  price: number; // kopecks
  select_type: 'checkbox' | string;
  select_units_max: number | null;
  selected_by_default: boolean;
  value: boolean | number;
}

export interface Reservation {
  passenger_id: number;
  wagon_id: string; // encrypted blob
  seat_number: number;
  first_name: string;
  last_name: string;
  input_type: null;
  privilege: null;
  privilege_data: Record<string, unknown>;
  privilege_id: null;
  companion_id: null;
  services: ReservationService[];
  passenger_options: unknown[];
  save_in_passengers: boolean;
}

export interface CreateOrderRequest {
  trip_id: number;
  reservations: Reservation[];
}

export interface CreateOrderResponse {
  cart_id: number;
}

export interface SeatHold {
  wagon_number: string; // plain coach number, NOT the encrypted wagon_id
  place: number;
}

export interface SeatHoldRequest {
  seats: SeatHold[];
  uuid: string; // x-session-id
}

export type CartStatusResponse =
  | {
      kind: 'pending';
      cart_id: number;
      title: string;
      description: string;
      retry_in: number; // seconds
    }
  | {
      kind: 'ready';
      cart_id: number;
      payment_url?: string;
      expire_at?: number; // unix sec
      [k: string]: unknown;
    };

export interface MatchRef {
  tripId: number;
  trainNumber: string;
  classId: string;
}

export interface ReserveOutcome {
  status:
    | 'order_enqueued'
    | 'cart_pending'
    | 'reserve_ok'
    | 'captcha'
    | 'rate_limited'
    | 'reserve_fail';
  cartId?: number;
  retryInSec?: number;
  paymentUrl?: string;
  reservedUntil?: number; // ms epoch, cart.expire_at
  detail?: string;
  relax?: string[];
  match?: MatchRef;
}

export interface SearchTripsParams {
  fromId: number;
  toId: number;
  date: string; // YYYY-MM-DD
}

export interface OrderTrainSummary {
  station_from: string | Station;
  station_to: string | Station;
  number: string;
  type: number;
}

export interface OrderTripSummary {
  id: number;
  station_from: string;
  station_to: string;
  depart_at: number; // unix sec
  arrive_at: number; // unix sec
  stations_time_offset?: number;
}

export interface OrderTicketReservation {
  id: number;
  first_name: string;
  last_name: string;
  wagon_number: string;
  wagon_class_id: string;
  wagon_class_name: string;
  seat_number: string;
  services: Array<{ id: string; title: string }>;
  price: number; // kopecks
  description: string | null;
}

export interface OrderTicket {
  id: number;
  note: string | null;
  returned_at: number | null;
  pdf_url: string | null;
  reservation: OrderTicketReservation;
  has_return_status: boolean;
}

export interface UserOrder {
  id: number;
  train: OrderTrainSummary;
  trip: OrderTripSummary;
  tickets: OrderTicket[];
  [k: string]: unknown;
}

export interface Pagination {
  total: number;
  count: number;
  per_page: number;
  current_page: number;
  total_pages: number;
}

export interface ActiveOrdersResponse {
  orders: UserOrder[];
  hasArchived: boolean;
}

export interface ArchivedOrdersResponse {
  orders: UserOrder[];
  pagination: Pagination;
}

export interface UzAuthHeaders {
  Authorization: `Bearer ${string}`;
  'x-session-id': string;
  'x-user-agent': `UZ/2 Web/1 User/${number}`;
  'x-client-locale': 'uk' | 'en';
  accept: 'application/json';
}

export interface UzSession {
  authToken: string; // raw JWT, without 'Bearer '
  sessionId: string;
  userId: number;
  fetchedAt: number;
}

export interface DebugEvent {
  seq?: number;
  t: number;
  ctx: 'sw' | 'content' | 'page';
  kind: 'req' | 'nav' | 'session' | 'note';
  // kind: 'req'
  method?: string;
  url?: string;
  status?: number;
  ms?: number;
  reqHeaders?: Record<string, string>;
  reqBody?: string;
  resBody?: string;
  // kind: 'nav'
  navType?: string;
  from?: string;
  to?: string;
  // kind: 'session'
  sessionId?: string;
  hasToken?: boolean;
  userId?: string | number;
  // kind: 'note'
  label?: string;
  detail?: string;
}
