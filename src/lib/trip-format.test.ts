import { describe, it, expect } from 'vitest';
import { byDeparture, durationLabel, hasFreeSeats, hhmm, totalFreeSeats } from './trip-format';
import type { Trip } from './models';

function makeTrip(over: Partial<Trip> & { depart_at: number }): Trip {
  return {
    id: 1,
    arrive_at: over.depart_at + 3600,
    station_from: { id: 1, name: 'A' },
    station_to: { id: 2, name: 'B' },
    train: {
      id: 1,
      number: '066П',
      type: 0,
      station_from: 'A',
      station_to: 'B',
      wagon_classes: [
        { id: 'К', name: 'Купе', free_seats: 101, price: 26636, amenities: [] },
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

describe('trip-format', () => {
  it('hhmm formats unix seconds and guards empty', () => {
    // 1783023780 = a concrete instant; just assert HH:MM shape.
    expect(hhmm(1783023780)).toMatch(/^\d{2}:\d{2}$/);
    expect(hhmm(undefined)).toBe('—');
    expect(hhmm(0)).toBe('—');
  });

  it('durationLabel handles hours+minutes, minutes-only, hours-only', () => {
    expect(durationLabel(0, 9000)).toBe('2 год 30 хв');
    expect(durationLabel(0, 2700)).toBe('45 хв');
    expect(durationLabel(0, 7200)).toBe('2 год');
    expect(durationLabel(100, 0)).toBe('0 хв');
  });

  it('totalFreeSeats / hasFreeSeats sum across classes', () => {
    const t = makeTrip({ depart_at: 1000 });
    expect(totalFreeSeats(t)).toBe(101);
    expect(hasFreeSeats(t)).toBe(true);
  });

  it('byDeparture sorts ascending without mutating', () => {
    const a = makeTrip({ depart_at: 300 });
    const b = makeTrip({ depart_at: 100 });
    const input = [a, b];
    const sorted = byDeparture(input);
    expect(sorted.map((t) => t.depart_at)).toEqual([100, 300]);
    expect(input.map((t) => t.depart_at)).toEqual([300, 100]); // untouched
  });
});
