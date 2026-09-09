export interface Station {
  id: number;
  name: string;
}

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
  kind: string;
  why: string;
  distanceKm: number | null;
}

export interface KnownRoute {
  routeKey: string;
  hits: number;
  route: Record<string, unknown>;
}

export interface Watch {
  id: string;
  name: string;
  fromId: number;
  toId: number;
  dateFrom: string;
  dateTo: string;
  classes: string[];
  maxPriceKop: number | null;
  favorite: boolean;
  state: 'active' | 'paused' | 'done';
  dates: string[];
  routes: KnownRoute[];
}

export interface WatchEvent {
  id: number;
  kind: string;
  payload: Record<string, unknown>;
  createdAt: number;
  notifiedAt: number | null;
}

export interface Stats {
  report: { total: number; network: number; cached: number; perHour: number; bytes: number };
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
