import { describe, it, expect } from 'vitest';
import { resolveMatch } from './match-trip';
import type { Trip } from '@/lib/models';

function makeTrip(over: Partial<Trip> & { id: number; number: string }): Trip {
  return {
    arrive_at: 0,
    depart_at: 0,
    station_from: { id: 1, name: 'A' },
    station_to: { id: 2, name: 'B' },
    train: {
      id: over.id,
      number: over.number,
      type: 0,
      station_from: 'A',
      station_to: 'B',
      wagon_classes: [
        { id: 'К', name: 'Купе', free_seats: 10, price: 26636, amenities: [] },
        { id: 'П', name: 'Плацкарт', free_seats: 0, price: 19692, amenities: [] },
      ],
    },
    route_points: [],
    monitoring: { allowed: true, auto_purchase: true },
    seat_hold_enabled: true,
    max_passengers_count: 4,
    ...over,
  } as Trip;
}

describe('resolveMatch', () => {
  const trips = [makeTrip({ id: 1, number: '066П' }), makeTrip({ id: 2, number: '091К' })];

  it('picks the first class with free seats when no filters given', () => {
    expect(resolveMatch(trips, [], [])).toEqual({ tripId: 1, trainNumber: '066П', classId: 'К' });
  });

  it('honors the preferred-trains filter', () => {
    expect(resolveMatch(trips, ['091К'], [])).toEqual({
      tripId: 2,
      trainNumber: '091К',
      classId: 'К',
    });
    expect(resolveMatch(trips, ['777'], [])).toBeNull();
  });

  it('honors the coach-types filter and skips sold-out classes', () => {
    expect(resolveMatch(trips, [], ['П'])).toBeNull();
    expect(resolveMatch(trips, [], ['К'])?.classId).toBe('К');
  });

  it('returns null for an empty trip list', () => {
    expect(resolveMatch([], [], [])).toBeNull();
  });
});
