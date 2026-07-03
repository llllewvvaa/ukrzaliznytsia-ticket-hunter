import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './ui';
import { SeatMap } from './SeatMap';
import { SkeletonRows } from './Skeleton';
import { BackIcon, CheckIcon } from './icons';
import { dialogIn, dialogOut } from '@/lib/anim';
import { query } from '@/lib/messages';
import type { MatchRef, Wagon } from '@/lib/models';

export function SeatPickerModal({
  open,
  match,
  count,
  onClose,
  onConfirm,
}: {
  open: boolean;
  match: MatchRef;
  count: number | null;
  onClose: () => void;
  onConfirm: (pick: { wagonNumber: string; seats: number[] }) => void;
}) {
  const [mounted, setMounted] = useState(open);
  const [wagons, setWagons] = useState<Wagon[] | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [wagonNumber, setWagonNumber] = useState<string | null>(null);
  const [seats, setSeats] = useState<number[]>([]);
  const backdropRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useLayoutEffect(() => {
    const backdrop = backdropRef.current;
    const card = cardRef.current;
    if (!backdrop || !card) return;
    if (open) dialogIn(backdrop, card);
    else if (mounted) dialogOut(backdrop, card, () => setMounted(false));
  }, [open, mounted]);

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
    setSeats((prev) =>
      prev.includes(seat) ? prev.filter((s) => s !== seat) : [...prev, seat],
    );
  };

  const atLimit = count != null && seats.length >= count;
  const done =
    wagonNumber != null && seats.length >= 1 && (count == null || seats.length === count);

  if (!mounted) return null;

  return createPortal(
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[70] flex flex-col bg-gray-900/40 p-3"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex items-center justify-between gap-2 border-b border-gray-200 px-4 py-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-gray-900">
              Оберіть місця · {match.trainNumber} ({match.classId})
            </h3>
            <p className="text-[11px] text-gray-500">
              Обрано {seats.length}
              {count != null ? ` / ${count}` : ''}
              {wagonNumber ? ` · вагон ${wagonNumber}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрити"
            className="grid h-7 w-7 place-items-center rounded-md text-gray-500 transition-colors hover:bg-gray-100"
          >
            <BackIcon className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {loading ? (
            <SkeletonRows count={4} />
          ) : error ? (
            <p className="rounded-lg bg-gray-50 p-4 text-center text-xs text-gray-500">{error}</p>
          ) : wagons && wagons.length > 0 ? (
            wagons.map((w) => (
              <SeatMap
                key={w.id || w.number}
                wagon={w}
                selected={wagonNumber === w.number ? seats : []}
                onToggle={(seat) => toggle(w.number, seat)}
                maxReached={wagonNumber === w.number && atLimit}
              />
            ))
          ) : (
            <p className="rounded-lg bg-gray-50 p-4 text-center text-xs text-gray-500">
              Вільних місць немає.
            </p>
          )}
        </div>

        <footer className="border-t border-gray-200 p-3">
          <Button
            variant="primary"
            className="w-full"
            disabled={!done}
            onClick={() => {
              if (done && wagonNumber) onConfirm({ wagonNumber, seats });
            }}
          >
            <CheckIcon className="h-4 w-4" />
            {done
              ? `Зарезервувати місця ${seats.join(', ')}`
              : count != null
                ? `Оберіть ${count} ${count === 1 ? 'місце' : 'місця'}`
                : 'Оберіть місця'}
          </Button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
