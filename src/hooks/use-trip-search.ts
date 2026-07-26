import { useCallback, useEffect, useRef, useState } from 'react';
import { query } from '@/lib/messages';
import { byDeparture } from '@/lib/format/trip-format';
import { trainNoteForCode } from '@/lib/format/query-notes';
import { DATE_RE } from '@/lib/format/date';
import type { Station, Trip } from '@/lib/models';

// Searches trips for a route+date, deduped by an id key: `from`/`to` are
// objects whose identity can change without the route changing, and the
// effect must not refetch then. `refresh` resets the key to force a refetch.
export function useTripSearch(from: Station | null, to: Station | null, date: string) {
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [note, setNote] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const searchedKey = useRef<string | null>(null);

  const search = useCallback(() => {
    if (!from || !to) {
      setNote('Спочатку оберіть станції.');
      return;
    }
    setLoading(true);
    setNote(undefined);
    void query<Trip[]>('trips', { fromId: from.id, toId: to.id, date })
      .then((r) => {
        if (r.ok && Array.isArray(r.data)) {
          setTrips(byDeparture(r.data));
          setNote(r.data.length === 0 ? 'На цю дату поїздів не знайдено.' : undefined);
        } else {
          setTrips(null);
          setNote(trainNoteForCode(r.code));
        }
      })
      .finally(() => setLoading(false));
  }, [from, to, date]);

  useEffect(() => {
    if (!from || !to || !DATE_RE.test(date)) return;
    const key = `${from.id}-${to.id}-${date}`;
    if (key === searchedKey.current) return;
    searchedKey.current = key;
    search();
  }, [from, to, date, search]);

  const refresh = useCallback((): void => {
    searchedKey.current = null;
    search();
  }, [search]);

  return { trips, note, loading, refresh };
}
