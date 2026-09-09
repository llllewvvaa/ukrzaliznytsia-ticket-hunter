import type {
  RoutePoint,
  SearchResult,
  Station,
  Trip,
  TripDetail,
  Wagon,
  WagonClassOffer,
} from './types.js';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : value == null ? fallback : String(value);
}

export function parseStations(raw: unknown): Station[] {
  return asArray(raw).map((entry) => {
    const s = asRecord(entry);
    return { id: num(s.id), name: str(s.name ?? s.title) };
  });
}

export function parseWagonClasses(raw: unknown): WagonClassOffer[] {
  return asArray(raw).map((entry) => {
    const c = asRecord(entry);
    return {
      id: str(c.id),
      name: str(c.name),
      freeSeats: num(c.free_seats),
      priceKop: num(c.price),
      amenities: asArray(c.amenities).map((a) => str(a)),
    };
  });
}

export function parseTrip(raw: unknown): Trip {
  const t = asRecord(raw);
  const train = asRecord(t.train);
  const monitoring = asRecord(t.monitoring);
  return {
    id: num(t.id),
    trainId: num(train.id),
    trainNumber: str(train.number),
    departAt: num(t.depart_at),
    arriveAt: num(t.arrive_at),
    stationFrom: str(t.station_from),
    stationTo: str(t.station_to),
    distanceKm: t.distance == null ? null : num(t.distance),
    isDeparted: Boolean(t.is_departed),
    monitoringAllowed: Boolean(monitoring.allowed),
    seatHoldEnabled: Boolean(t.seat_hold_enabled),
    classes: parseWagonClasses(train.wagon_classes),
  };
}

export function parseSearch(raw: unknown): SearchResult {
  const r = asRecord(raw);
  const direct = asArray(r.direct).map(parseTrip);
  const withTransfer = asArray(r.with_transfer).map((variant) =>
    Array.isArray(variant) ? variant.map(parseTrip) : [parseTrip(variant)],
  );
  return { direct, withTransfer };
}

export function parseRoutePoints(raw: unknown): RoutePoint[] {
  return asArray(raw).map((entry, index) => {
    const p = asRecord(entry);
    const station = asRecord(p.station);
    return {
      seq: index,
      stationId: num(station.id),
      stationName: str(station.name),
      arriveAt: p.arrive_at == null ? null : num(p.arrive_at),
      departAt: p.depart_at == null ? null : num(p.depart_at),
    };
  });
}

export function parseTripDetail(raw: unknown): TripDetail {
  const t = asRecord(raw);
  const train = asRecord(t.train);
  return {
    id: num(t.id),
    trainId: num(train.id),
    trainNumber: str(train.number),
    stationFromId: num(asRecord(t.station_from).id),
    stationToId: num(asRecord(t.station_to).id),
    departAt: num(t.depart_at),
    arriveAt: num(t.arrive_at),
    routePoints: parseRoutePoints(t.route_points),
  };
}

function parseSeatNumbers(raw: unknown): number[] {
  const out: number[] = [];
  for (const entry of asArray(raw)) {
    const n =
      typeof entry === 'object' && entry !== null
        ? num((entry as Record<string, unknown>).num ?? (entry as Record<string, unknown>).number)
        : num(entry, Number.NaN);
    if (Number.isInteger(n) && n > 0) out.push(n);
  }
  return out;
}

export function parseWagons(raw: unknown): Wagon[] {
  const r = asRecord(raw);
  const list = Array.isArray(r.wagons) ? r.wagons : asArray(raw);
  return list.map((entry) => {
    const w = asRecord(entry);
    return {
      id: str(w.id),
      number: str(w.number),
      wagonKey: str(w.wagon_key),
      mockupName: str(w.mockup_name),
      seats: parseSeatNumbers(w.seats ?? w.places ?? w.free_places),
      freeSeatsLower: num(w.free_seats_lower),
      freeSeatsTop: num(w.free_seats_top),
      priceKop: num(w.price),
      airConditioner: Boolean(w.air_conditioner),
      services: asArray(w.services).map((s) => str(asRecord(s).id)),
    };
  });
}
