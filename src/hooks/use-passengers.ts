import { useEffect, useState } from 'react';
import { query } from '@/lib/messages';
import type { Passenger } from '@/lib/models';

// null passengers = still loading; an empty list with a note means the fetch
// failed (or logged out) and the UI falls back to manual ID entry.
export function usePassengers(): { passengers: Passenger[] | null; note: string | undefined } {
  const [passengers, setPassengers] = useState<Passenger[] | null>(null);
  const [note, setNote] = useState<string | undefined>();

  useEffect(() => {
    void query<Passenger[]>('passengers').then((r) => {
      if (r.ok && Array.isArray(r.data)) {
        setPassengers(r.data);
      } else {
        setPassengers([]);
        setNote(
          r.code === 'not_authenticated'
            ? 'Залогіньтесь у booking.uz, щоб завантажити пасажирів.'
            : 'Не вдалося завантажити пасажирів — введіть ID вручну.',
        );
      }
    });
  }, []);

  return { passengers, note };
}
