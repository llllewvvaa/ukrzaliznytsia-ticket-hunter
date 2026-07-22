import { useEffect, useState } from 'react';
import { query } from '@/lib/messages';
import type { MatchRef, Wagon } from '@/lib/models';

// Loads wagons when the modal opens (resetting any previous pick) and owns the
// seat toggle: seats are confined to a single wagon, so picking a seat in
// another wagon switches the selection over.
export function useSeatPicker(open: boolean, match: MatchRef) {
  const [wagons, setWagons] = useState<Wagon[] | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [wagonNumber, setWagonNumber] = useState<string | null>(null);
  const [seats, setSeats] = useState<number[]>([]);

  useEffect(() => {
    if (!open) return;
    setWagons(null);
    setError(undefined);
    setWagonNumber(null);
    setSeats([]);
    setLoading(true);
    void query<Wagon[]>('wagons', { tripId: match.tripId, classId: match.classId })
      .then((res) => {
        if (res.ok && Array.isArray(res.data)) setWagons(res.data);
        else if (res.code === 'not_authenticated') setError('Залогіньтесь у booking.uz.');
        else setError(`Не вдалося завантажити місця. ${res.error ?? res.code ?? ''}`.trim());
      })
      .finally(() => setLoading(false));
  }, [open, match.tripId, match.classId]);

  const toggle = (wagonNum: string, seat: number): void => {
    if (wagonNumber !== wagonNum) {
      setWagonNumber(wagonNum);
      setSeats([seat]);
      return;
    }
    setSeats((prev) => (prev.includes(seat) ? prev.filter((s) => s !== seat) : [...prev, seat]));
  };

  return { wagons, error, loading, wagonNumber, seats, toggle };
}
