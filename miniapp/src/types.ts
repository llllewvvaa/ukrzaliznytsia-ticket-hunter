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
  | 'neighbor_date'
  | 'alight_earlier';

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
  segments?: Segment[];
}

export interface Segment {
  trainNumber: string;
  from: string;
  to: string;
  departAt: number;
  arriveAt: number;
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
  alightEarlierMin: number;
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

export interface WatchOption {
  tripId: number;
  trainNumber: string;
  date: string;
  classId: string;
  freeSeats: number;
  priceKop: number;
  departAt: number;
  arriveAt: number;
  journeyDepartAt: number;
  journeyArriveAt: number;
  durationMin: number;
  fromId: number;
  toId: number;
  fromName: string;
  toName: string;
  boardName: string;
  alightName: string;
  kind: CandidateKind;
  why: string;
  segments: Segment[] | null;
  takenAt: number;
  isNew: boolean;
}

export interface WatchOptions {
  options: WatchOption[];
  checkedAt: number | null;
  viewedBefore: number | null;
}

export const CLASS_NAME: Record<string, string> = {
  Л: 'Люкс',
  К: 'Купе',
  КД: 'Дитяче купе',
  КЖ: 'Жіноче купе',
  П: 'Плацкарт',
  С1: '1 клас',
  С2: '2 клас',
};

export function className(classId: string): string {
  if (classId.startsWith('MIX')) return 'з пересадкою';
  return CLASS_NAME[classId] ?? classId;
}
