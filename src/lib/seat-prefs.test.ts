import { describe, it, expect } from 'vitest';
import {
  berthOf,
  compartmentOf,
  compartmentRank,
  diagnoseRelaxations,
  relaxPrefs,
  selectSeats,
  wagonCapacity,
} from './seat-prefs';
import type { Wagon } from './models';

function w(over: Partial<Wagon>): Wagon {
  return {
    id: 'enc',
    number: '3',
    seats: [],
    free_seats_top: 0,
    free_seats_lower: 0,
    price: 26636,
    air_conditioner: false,
    mockup_name: 'Купейний вагон 36 місць',
    ...over,
  };
}

describe('berthOf / compartmentOf / wagonCapacity', () => {
  it('odd seats are lower, even seats are upper', () => {
    expect(berthOf(33)).toBe('lower');
    expect(berthOf(34)).toBe('upper');
    expect(berthOf(1)).toBe('lower');
    expect(berthOf(2)).toBe('upper');
  });

  it('groups seats into compartments of four', () => {
    expect(compartmentOf(1)).toBe(1);
    expect(compartmentOf(4)).toBe(1);
    expect(compartmentOf(5)).toBe(2);
    expect(compartmentOf(33)).toBe(9);
    expect(compartmentOf(36)).toBe(9);
  });

  it('ranks compartments centre → start → end', () => {
    // 9 compartments, centre = 5. Sorting the eligible middle by rank:
    const order = [2, 3, 4, 5, 6, 7, 8].sort(
      (a, b) => compartmentRank(a, 9) - compartmentRank(b, 9),
    );
    expect(order).toEqual([5, 4, 3, 2, 6, 7, 8]);
  });

  it('reads capacity from mockup_name', () => {
    expect(wagonCapacity(w({}))).toBe(36);
    expect(wagonCapacity(w({ mockup_name: undefined, seats: [3, 10, 20] }))).toBe(20);
  });
});

describe('selectSeats', () => {
  it('takes the lowest free seats with no prefs', () => {
    const choice = selectSeats([w({ seats: [12, 8, 20] })], 2);
    expect(choice?.seats).toEqual([8, 12]);
  });

  it('restricts to lower berths (odd) when asked', () => {
    const choice = selectSeats([w({ seats: [33, 34, 35, 36] })], 2, { berth: 'lower' });
    expect(choice?.seats).toEqual([33, 35]);
  });

  it('restricts to upper berths (even) when asked', () => {
    const choice = selectSeats([w({ seats: [33, 34, 35, 36] })], 2, { berth: 'upper' });
    expect(choice?.seats).toEqual([34, 36]);
  });

  it('avoids the end compartments (toilets) when asked', () => {
    // capacity 36 → end compartments are 1 (seats 1–4) and 9 (33–36).
    const choice = selectSeats([w({ seats: [2, 4, 30, 33, 34] })], 1, { avoidToilet: true });
    expect(choice?.seats).toEqual([30]);
  });

  it('avoid-toilet auto-pick prefers the centre, then the start, then the end', () => {
    // 9 compartments; toilets at comp 1 & 9 excluded. One free seat per eligible
    // compartment 2..8 (5→c2, 9→c3, 13→c4, 17→c5 centre, 21→c6, 25→c7, 29→c8).
    const wag = [w({ seats: [5, 9, 13, 17, 21, 25, 29] })];
    expect(selectSeats(wag, 1, { avoidToilet: true })?.seats).toEqual([17]); // centre
    expect(selectSeats(wag, 3, { avoidToilet: true })?.seats).toEqual([17, 13, 9]); // → start
    // the whole beginning is used before the end side:
    expect(selectSeats(wag, 5, { avoidToilet: true })?.seats).toEqual([17, 13, 9, 5, 21]);
  });

  it('centre-out order applies within adjacency too', () => {
    // Two free compartments: c5 (centre, seats 17,18) and c2 (start, seats 5,6).
    const choice = selectSeats([w({ seats: [5, 6, 17, 18] })], 2, {
      avoidToilet: true,
      adjacent: true,
    });
    expect(choice?.seats).toEqual([17, 18]); // centre compartment wins
  });

  it('keeps 2 passengers in the same compartment when adjacent', () => {
    const choice = selectSeats([w({ seats: [10, 33, 34] })], 2, { adjacent: true });
    expect(choice?.seats).toEqual([33, 34]); // both in compartment 9
  });

  it('returns null when adjacency cannot be satisfied (strict)', () => {
    // 10→comp3, 30→comp8: no compartment holds two free seats.
    expect(selectSeats([w({ seats: [10, 30] })], 2, { adjacent: true })).toBeNull();
  });

  it('skips non-air-conditioned wagons when airConditioned is required', () => {
    const choice = selectSeats(
      [w({ seats: [2, 4], air_conditioner: false }), w({ id: 'ac', seats: [6, 8], air_conditioner: true })],
      1,
      { airConditioned: true },
    );
    expect(choice?.wagon.id).toBe('ac');
    expect(choice?.seats).toEqual([6]);
  });

  it('returns null when a hard constraint cannot be met', () => {
    // only two lower berths free, but three requested.
    expect(selectSeats([w({ seats: [33, 34, 35, 36] })], 3, { berth: 'lower' })).toBeNull();
  });
});

describe('diagnoseRelaxations / relaxPrefs', () => {
  it('flags the single blocking pref (A/C) when dropping it would match', () => {
    // Seats exist (free), but no wagon is air-conditioned.
    const wagons = [w({ seats: [34, 36], air_conditioner: false })];
    const prefs = { airConditioned: true } as const;
    expect(selectSeats(wagons, 1, prefs)).toBeNull();
    expect(diagnoseRelaxations(wagons, 1, prefs)).toEqual(['airConditioned']);
  });

  it('returns empty when the prefs are already satisfiable', () => {
    const wagons = [w({ seats: [33, 35], air_conditioner: true })];
    expect(diagnoseRelaxations(wagons, 1, { berth: 'lower', airConditioned: true })).toEqual([]);
  });

  it('lists every pref that individually unblocks selection', () => {
    // 2 upper seats free, A/C off, want lower + A/C: dropping either alone fails
    // (upper still not lower / still no A/C), so neither single drop helps.
    const wagons = [w({ seats: [34, 36], air_conditioner: false })];
    expect(diagnoseRelaxations(wagons, 1, { berth: 'lower', airConditioned: true })).toEqual([]);
  });

  it('relaxPrefs drops one key and compacts to undefined when empty', () => {
    expect(relaxPrefs({ berth: 'lower' }, 'berth')).toBeUndefined();
    expect(relaxPrefs({ berth: 'lower', airConditioned: true }, 'airConditioned')).toEqual({
      berth: 'lower',
    });
  });
});
