import { useEffect, useRef, useState } from 'react';
import { query } from '@/lib/messages';
import { pickBestStation, stationQueryCandidates } from '@/lib/format/timetable';
import type { TimetableStation, TimetableTrain } from '@/lib/format/timetable';

// Timetable has its own id space; seed from booking.uz name but keep editable.
export function useTimetableSeed(
  value: TimetableStation | null,
  seedName: string | undefined,
  onChange: (s: TimetableStation | null) => void,
  setText: (name: string) => void,
): void {
  const seeded = useRef(false);

  useEffect(() => {
    if (seeded.current || value || !seedName) return;
    seeded.current = true;
    void (async () => {
      for (const q of stationQueryCandidates(seedName)) {
        const r = await query<TimetableStation[]>('timetableStations', { q });
        if (r.ok && r.data && r.data.length > 0) {
          const best = pickBestStation(r.data, seedName);
          if (best) {
            onChange(best);
            setText(best.name);
          }
          return;
        }
      }
    })();
  }, [seedName, value, onChange, setText]);
}

// Fetches the timetable once both stations are known; a failure degrades to
// manual train-number entry instead of blocking the form.
export function useTimetableTrains(from: TimetableStation | null, to: TimetableStation | null) {
  const [trains, setTrains] = useState<TimetableTrain[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string | undefined>();
  const [manual, setManual] = useState(false);

  useEffect(() => {
    if (!from || !to) {
      setTrains(null);
      return;
    }
    const failManual = (): void => {
      setNote('Не вдалося завантажити розклад — введіть номер вручну.');
      setManual(true);
    };
    setLoading(true);
    setNote(undefined);
    void query<TimetableTrain[]>('timetable', { fromIds: from.ids, toIds: to.ids })
      .then((r) => {
        if (r.ok && Array.isArray(r.data)) {
          setTrains(r.data);
          if (r.data.length === 0) {
            setNote(
              'У розкладі немає прямих поїздів для цих станцій — перевірте вибір або введіть номер вручну.',
            );
          }
        } else {
          failManual();
        }
      })
      .catch(failManual)
      .finally(() => setLoading(false));
  }, [from, to]);

  return { trains, loading, note, manual, setManual };
}
