import type { MatchRef, Trip } from '@/lib/models';

// First trip matching the job's train/coach filters that still has free seats.
export function resolveMatch(
  trips: Trip[],
  preferredTrains: string[],
  coachTypes: Array<string>,
): MatchRef | null {
  const trains = preferredTrains.length
    ? trips.filter((t) => preferredTrains.includes(t.train.number))
    : trips;
  for (const trip of trains) {
    const classes = coachTypes.length
      ? trip.train.wagon_classes.filter((c) => coachTypes.includes(c.id))
      : trip.train.wagon_classes;
    const cls = classes.find((c) => c.free_seats > 0);
    if (cls) return { tripId: trip.id, trainNumber: trip.train.number, classId: String(cls.id) };
  }
  return null;
}
