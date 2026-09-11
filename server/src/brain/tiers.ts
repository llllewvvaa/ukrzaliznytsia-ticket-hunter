export type Tier = 1 | 2 | 3;

export interface Tierable {
  kind: string;
  date: string;
  trainNumber: string;
  classId: string;
  priceKop: number;
}

// The owner's order of preference, applied separately to every class of every
// train on every day: an ordinary ticket first; failing that, a longer ticket on
// the same train (board earlier or ride further); failing that, a ticket to the
// stop just before the destination and a few minutes standing in the vestibule.
// A class that has 2nd-class seats outright can still need a detour for 1st
// class, so the key includes the class.
export function tierOf(kind: string): Tier {
  if (kind === 'board_earlier' || kind === 'ride_further') return 2;
  if (kind === 'alight_earlier') return 3;
  return 1;
}

// Within the winning tier one ticket is enough: the same run can be bought from
// Злочів or from Тернопіль for one boarding in Львів, and only the cheaper one
// is worth showing.
export function applyTiers<T extends Tierable>(options: T[]): T[] {
  const best = new Map<string, T>();
  for (const option of options) {
    const key = `${option.date}:${option.trainNumber}:${option.classId}`;
    const current = best.get(key);
    if (!current) {
      best.set(key, option);
      continue;
    }
    const tier = tierOf(option.kind);
    const currentTier = tierOf(current.kind);
    if (tier < currentTier || (tier === currentTier && option.priceKop < current.priceKop))
      best.set(key, option);
  }
  const kept = new Set(best.values());
  return options.filter((option) => kept.has(option));
}
