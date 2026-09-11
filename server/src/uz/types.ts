export interface Station {
  id: number;
  name: string;
}

export interface WagonClassOffer {
  id: string;
  name: string;
  freeSeats: number;
  priceKop: number;
  amenities: string[];
}

export interface Trip {
  id: number;
  trainNumber: string;
  trainId: number;
  departAt: number;
  arriveAt: number;
  stationFrom: string;
  stationTo: string;
  distanceKm: number | null;
  isDeparted: boolean;
  monitoringAllowed: boolean;
  seatHoldEnabled: boolean;
  classes: WagonClassOffer[];
}

export type TransferLeg = Trip;

export interface SearchResult {
  direct: Trip[];
  withTransfer: TransferLeg[][];
}

export interface RoutePoint {
  seq: number;
  stationId: number;
  stationName: string;
  arriveAt: number | null;
  departAt: number | null;
}

export interface TripDetail {
  id: number;
  trainId: number;
  trainNumber: string;
  stationFromId: number;
  stationToId: number;
  departAt: number;
  arriveAt: number;
  routePoints: RoutePoint[];
}

export interface Wagon {
  id: string;
  number: string;
  wagonKey: string;
  mockupName: string;
  seats: number[];
  freeSeatsLower: number;
  freeSeatsTop: number;
  priceKop: number;
  airConditioner: boolean;
  services: string[];
}
