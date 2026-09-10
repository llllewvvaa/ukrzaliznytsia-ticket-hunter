export interface Station {
  id: number;
  name: string;
}

export type CandidateKind =
  | 'direct'
  | 'transfers'
  | 'ride_further'
  | 'board_earlier'
  | 'neighbor_from'
  | 'neighbor_to'
  | 'neighbor_date';

export interface Offer {
  tripId: number;
  trainNumber: string;
  fromId: number;
  toId: number;
  date: string;
  classId: string;
  className: string;
  freeSeats: number;
  priceKop: number;
  departAt: number;
  arriveAt: number;
  durationMin: number;
  legs: number;
  kind: CandidateKind;
  why: string;
  distanceKm: number | null;
}

export interface KnownRoute {
  routeKey: string;
  hits: number;
  route: Record<string, unknown>;
}

export interface SeatPrefs {
  berth?: 'lower' | 'upper';
  minSeats?: number;
  adjacent?: boolean;
  airConditioned?: boolean;
}

export interface Watch {
  id: string;
  name: string;
  fromId: number;
  toId: number;
  dateFrom: string;
  dateTo: string;
  classes: string[];
  seatPrefs: SeatPrefs;
  maxPriceKop: number | null;
  favorite: boolean;
  state: 'active' | 'paused' | 'done';
  createdAt: number;
  updatedAt: number;
  dates: string[];
  routes: KnownRoute[];
}

export interface WatchEvent {
  id: number;
  kind: 'appeared' | 'price_drop' | 'more_seats' | 'gone' | string;
  payload: Record<string, unknown>;
  createdAt: number;
  notifiedAt: number | null;
}

export interface Stats {
  report: {
    total: number;
    network: number;
    cached: number;
    perHour: number;
    bytes: number;
    byStatus: Record<string, number>;
  };
  probes: number;
  favorites: number;
  bruteForce: number;
  savings: number;
  atlas: { stations: number; trains: number; trips: number; pairs: number };
}

export interface Forecast {
  trainNumber: string;
  classId: string;
  horizon: string;
  observations: number;
  emptyObservations: number;
  appearances: number;
  probability: number | null;
  medianPriceKop: number | null;
  note: string;
}

export const CLASS_OPTIONS: { id: string; title: string }[] = [
  { id: 'Л', title: 'Люкс' },
  { id: 'К', title: 'Купе' },
  { id: 'П', title: 'Плацкарт' },
  { id: 'С1', title: 'Сидячий 1' },
  { id: 'С2', title: 'Сидячий 2' },
];
