import type { Wagon } from '../uz/types.js';
import type { SeatPrefs } from '../store/watches.js';

export interface SeatMatch {
  wagonNumber: string;
  wagonKey: string;
  seats: number[];
  lower: number;
  upper: number;
  priceKop: number;
  adjacentPairs: number[][];
}

export function isLowerBerth(seat: number): boolean {
  return seat % 2 === 1;
}

export function adjacentPairs(seats: number[]): number[][] {
  const set = new Set(seats);
  const pairs: number[][] = [];
  for (const seat of [...seats].sort((a, b) => a - b)) {
    if (isLowerBerth(seat) && set.has(seat + 1)) pairs.push([seat, seat + 1]);
  }
  return pairs;
}

export function matchWagons(wagons: Wagon[], prefs: SeatPrefs): SeatMatch[] {
  const minSeats = prefs.minSeats ?? 1;
  const matches: SeatMatch[] = [];

  for (const wagon of wagons) {
    if (prefs.airConditioned && !wagon.airConditioner) continue;

    const lower = wagon.seats.filter(isLowerBerth);
    const upper = wagon.seats.filter((seat) => !isLowerBerth(seat));
    let usable = wagon.seats;
    if (prefs.berth === 'lower') usable = lower;
    if (prefs.berth === 'upper') usable = upper;
    if (usable.length < minSeats) continue;

    const pairs = adjacentPairs(wagon.seats);
    if (prefs.adjacent && pairs.length === 0) continue;

    matches.push({
      wagonNumber: wagon.number,
      wagonKey: wagon.wagonKey,
      seats: usable,
      lower: lower.length,
      upper: upper.length,
      priceKop: wagon.priceKop,
      adjacentPairs: pairs,
    });
  }

  return matches.sort((a, b) => a.priceKop - b.priceKop || b.seats.length - a.seats.length);
}

export function describeMatch(match: SeatMatch): string {
  const head = `вагон ${match.wagonNumber} (${match.wagonKey})`;
  const seats = match.seats.slice(0, 8).join(', ');
  const more = match.seats.length > 8 ? '…' : '';
  return `${head}: нижніх ${match.lower}, верхніх ${match.upper}, місця ${seats}${more}`;
}
