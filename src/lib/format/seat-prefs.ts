import type { SeatPrefs, Wagon } from '@/lib/models';

export const COMPARTMENT_SIZE = 4;

export type Berth = 'lower' | 'upper';

// Berth is encoded by seat-number parity: odd = lower (Нижнє), even = upper (Верхнє).
export function berthOf(seat: number): Berth {
  return seat % 2 === 1 ? 'lower' : 'upper';
}

export function compartmentOf(seat: number, size = COMPARTMENT_SIZE): number {
  return Math.ceil(seat / size);
}

// avoid-toilet pick order: centre first, then toward the start, end-side compartments last.
export function compartmentRank(compartment: number, lastCompartment: number): number {
  const mid = (lastCompartment + 1) / 2;
  return compartment <= mid ? mid - compartment : lastCompartment + (compartment - mid);
}

// Capacity from `mockup_name` ("…36 місць"), else the highest seat number.
export function wagonCapacity(wagon: Wagon): number {
  const m = wagon.mockup_name?.match(/(\d+)\s*місц/);
  if (m) return Number(m[1]);
  return wagon.seats.length ? Math.max(...wagon.seats) : 0;
}

export interface SeatChoice {
  wagon: Wagon;
  seats: number[];
}

function eligibleSeats(wagon: Wagon, prefs: SeatPrefs): number[] {
  const lastCompartment = Math.ceil(wagonCapacity(wagon) / COMPARTMENT_SIZE);
  const free = wagon.seats.filter((seat) => {
    if (prefs.berth && berthOf(seat) !== prefs.berth) return false;
    if (prefs.avoidToilet) {
      // Toilets sit at the carriage ends → skip the first/last compartments.
      const c = compartmentOf(seat);
      if (c === 1 || c === lastCompartment) return false;
    }
    return true;
  });
  if (prefs.avoidToilet) {
    return free.sort(
      (a, b) =>
        compartmentRank(compartmentOf(a), lastCompartment) -
          compartmentRank(compartmentOf(b), lastCompartment) || a - b,
    );
  }
  return free.sort((a, b) => a - b);
}

// `need` seats from a single compartment, or [] if none holds that many.
function pickAdjacent(seats: number[], need: number): number[] {
  const byCompartment = new Map<number, number[]>();
  for (const seat of seats) {
    const c = compartmentOf(seat);
    const group = byCompartment.get(c) ?? [];
    group.push(seat);
    byCompartment.set(c, group);
  }
  for (const group of byCompartment.values()) {
    if (group.length >= need) return group.slice(0, need);
  }
  return [];
}

// First wagon + seats satisfying `prefs`; null when none can (caller keeps hunting).
export function selectSeats(
  wagons: Wagon[],
  count: number,
  prefs: SeatPrefs = {},
): SeatChoice | null {
  const need = Math.max(1, count);
  for (const wagon of wagons) {
    if (prefs.airConditioned && !wagon.air_conditioner) continue;
    const eligible = eligibleSeats(wagon, prefs);
    const chosen =
      prefs.adjacent && need > 1 ? pickAdjacent(eligible, need) : eligible.slice(0, need);
    if (chosen.length >= need) return { wagon, seats: chosen.slice(0, need) };
  }
  return null;
}

export type SeatPrefKey = 'airConditioned' | 'avoidToilet' | 'berth' | 'adjacent';

export const SEAT_PREF_LABELS: Record<SeatPrefKey, string> = {
  airConditioned: 'кондиціонер',
  avoidToilet: 'подалі від туалету',
  berth: 'вибір полиці',
  adjacent: 'місця поряд',
};

function withoutPref(prefs: SeatPrefs, key: SeatPrefKey): SeatPrefs {
  const next: SeatPrefs = { ...prefs };
  if (key === 'berth') delete next.berth;
  else if (key === 'airConditioned') next.airConditioned = false;
  else if (key === 'avoidToilet') next.avoidToilet = false;
  else next.adjacent = false;
  return next;
}

export function activeSeatPrefKeys(prefs: SeatPrefs | undefined): SeatPrefKey[] {
  if (!prefs) return [];
  const keys: SeatPrefKey[] = [];
  if (prefs.airConditioned) keys.push('airConditioned');
  if (prefs.avoidToilet) keys.push('avoidToilet');
  if (prefs.berth) keys.push('berth');
  if (prefs.adjacent) keys.push('adjacent');
  return keys;
}

export function relaxPrefs(prefs: SeatPrefs, key: SeatPrefKey): SeatPrefs | undefined {
  const next = withoutPref(prefs, key);
  const compact: SeatPrefs = {};
  if (next.berth) compact.berth = next.berth;
  if (next.adjacent) compact.adjacent = true;
  if (next.avoidToilet) compact.avoidToilet = true;
  if (next.airConditioned) compact.airConditioned = true;
  return Object.keys(compact).length > 0 ? compact : undefined;
}

// Active prefs that are individually blocking: dropping any one enables a selection.
export function diagnoseRelaxations(
  wagons: Wagon[],
  count: number,
  prefs: SeatPrefs,
): SeatPrefKey[] {
  if (selectSeats(wagons, count, prefs)) return [];
  const active: SeatPrefKey[] = [];
  if (prefs.airConditioned) active.push('airConditioned');
  if (prefs.avoidToilet) active.push('avoidToilet');
  if (prefs.berth) active.push('berth');
  if (prefs.adjacent && count > 1) active.push('adjacent');
  return active.filter((key) => selectSeats(wagons, count, withoutPref(prefs, key)) != null);
}
