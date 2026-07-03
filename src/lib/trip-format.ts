import type { Trip } from './models';

export function hhmm(unixSec: number | undefined): string {
  if (!unixSec) return '—';
  return new Date(unixSec * 1000).toLocaleTimeString('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function durationLabel(fromSec: number, toSec: number): string {
  const mins = Math.max(0, Math.round((toSec - fromSec) / 60));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return `${m} хв`;
  return m > 0 ? `${h} год ${m} хв` : `${h} год`;
}

export function totalFreeSeats(trip: Trip): number {
  return trip.train.wagon_classes.reduce((sum, c) => sum + (c.free_seats || 0), 0);
}

export function hasFreeSeats(trip: Trip): boolean {
  return totalFreeSeats(trip) > 0;
}

export function byDeparture(trips: Trip[]): Trip[] {
  return [...trips].sort((a, b) => a.depart_at - b.depart_at);
}
