export interface SearchQuery {
  fromId: number;
  toId: number;
  date: string;
  withTransfers?: boolean;
}

export function searchTripsPath(q: SearchQuery): string {
  const wt = q.withTransfers ? 1 : 0;
  return `/v3/trips?with_transfers=${wt}&date=${encodeURIComponent(q.date)}&station_from_id=${q.fromId}&station_to_id=${q.toId}`;
}

export function tripDetailPath(tripId: number): string {
  return `/v3/trips/${tripId}`;
}

export function wagonsByClassPath(tripId: number, classId: string): string {
  return `/v3/trips/${tripId}/wagons-by-class/${encodeURIComponent(classId)}`;
}

export function stationsPath(query: string): string {
  return `/stations?search=${encodeURIComponent(query)}`;
}

export function departureDatesPath(fromId: number, toId: number): string {
  return `/trips/departure-dates?station_from_id=${fromId}&station_to_id=${toId}`;
}
