import { useCallback, useEffect, useRef, useState } from 'react';
import { Chip, Input } from '@/components/ui';
import { SkeletonRows } from '@/components/Skeleton';
import { CheckIcon, ForwardIcon, SearchIcon, TicketIcon } from '@/components/icons';
import { SeatPickerModal } from './SeatPickerModal';
import { query } from '@/lib/messages';
import { byDeparture, durationLabel, hhmm } from '@/lib/trip-format';
import { staggerIn } from '@/lib/anim';
import { DATE_RE } from '@/lib/date';
import type { MatchRef, Station, Trip } from '@/lib/models';

export type SeatSelection = { match: MatchRef; wagonNumber: string; seats: number[] };

function noteForCode(code?: string): string {
  if (code === 'not_discovered') return 'Пошук поїздів недоступний — введіть номери вручну.';
  if (code === 'not_authenticated') return 'Залогіньтесь у booking.uz, щоб бачити поїзди.';
  return 'Не вдалося завантажити поїзди. Спробуйте оновити.';
}

export function TrainPicker({
  from,
  to,
  date,
  value,
  onChange,
  seatSelection,
  onSelectSeats,
  onClearSeats,
}: {
  from: Station | null;
  to: Station | null;
  date: string;
  value: string[];
  onChange: (next: string[]) => void;
  seatSelection: SeatSelection | null;
  onSelectSeats: (sel: SeatSelection) => void;
  onClearSeats: () => void;
}) {
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [note, setNote] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [manual, setManual] = useState(false);
  const [pickerMatch, setPickerMatch] = useState<MatchRef | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const searchedKey = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

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
          setNote(noteForCode(r.code));
        }
      })
      .finally(() => setLoading(false));
  }, [from, to, date]);

  // Fetch once per route+date.
  useEffect(() => {
    if (!from || !to || !DATE_RE.test(date)) return;
    const key = `${from.id}-${to.id}-${date}`;
    if (key === searchedKey.current) return;
    searchedKey.current = key;
    search();
  }, [from, to, date, search]);

  useEffect(() => {
    if (trips && trips.length && listRef.current) {
      staggerIn(Array.from(listRef.current.children));
    }
  }, [trips]);

  const toggle = (num: string): void =>
    onChange(value.includes(num) ? value.filter((n) => n !== num) : [...value, num]);

  const openPicker = (m: MatchRef): void => {
    setPickerMatch(m);
    setPickerOpen(true);
  };

  const refresh = (): void => {
    searchedKey.current = null;
    search();
  };

  const listedNumbers = new Set((trips ?? []).map((t) => t.train.number));
  const extraSelected = value.filter((n) => !listedNumbers.has(n));

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">
          {value.length === 0 ? 'Будь-який поїзд' : `Обрано: ${value.length}`}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={refresh}
            disabled={loading || !from || !to}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 disabled:opacity-40"
          >
            <SearchIcon className="h-3.5 w-3.5" />
            {loading ? 'Пошук…' : 'Оновити'}
          </button>
          <button
            type="button"
            onClick={() => setManual((m) => !m)}
            className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              manual ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            Вручну
          </button>
        </div>
      </div>

      {seatSelection ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          <span className="min-w-0">
            Місця обрано: поїзд <b>{seatSelection.match.trainNumber}</b> (
            {seatSelection.match.classId}), вагон <b>{seatSelection.wagonNumber}</b> ·{' '}
            {seatSelection.seats.join(', ')}
          </span>
          <button
            type="button"
            onClick={onClearSeats}
            className="shrink-0 rounded px-1.5 py-0.5 font-medium text-blue-700 transition-colors hover:bg-blue-100"
          >
            Скинути
          </button>
        </div>
      ) : null}

      {extraSelected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {extraSelected.map((n) => (
            <Chip key={n} active onClick={() => toggle(n)}>
              {n} ✕
            </Chip>
          ))}
        </div>
      ) : null}

      {manual ? (
        <Input
          placeholder="Номери через кому, напр. 091К, 057К"
          value={value.join(', ')}
          onChange={(e) =>
            onChange(
              e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            )
          }
        />
      ) : null}

      {loading ? (
        <SkeletonRows count={4} />
      ) : trips && trips.length > 0 ? (
        <div ref={listRef} className="space-y-2">
          {trips.map((t) => {
            const selected = value.includes(t.train.number);
            const pickedHere = seatSelection?.match.trainNumber === t.train.number;
            return (
              <div
                key={`${t.id}-${t.train.number}`}
                className={`rounded-xl border p-3 transition-all duration-200 ${
                  selected || pickedHere
                    ? 'border-blue-600 bg-blue-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggle(t.train.number)}
                  aria-pressed={selected}
                  className="block w-full text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold tabular-nums text-gray-900">
                        {hhmm(t.depart_at)}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-gray-400">
                        <span className="h-px w-3 bg-gray-300" />
                        {durationLabel(t.depart_at, t.arrive_at)}
                        <ForwardIcon className="h-3 w-3" />
                      </span>
                      <span className="text-base font-bold tabular-nums text-gray-900">
                        {hhmm(t.arrive_at)}
                      </span>
                    </div>
                    <span className="flex items-center gap-1.5">
                      <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-xs font-bold text-gray-700">
                        {t.train.number}
                      </span>
                      {selected ? <CheckIcon className="h-4 w-4 text-blue-600" /> : null}
                    </span>
                  </div>

                  <div className="mt-1 truncate text-[11px] text-gray-500">
                    {t.train.station_from} → {t.train.station_to}
                  </div>
                </button>

                <div className="mt-1.5 flex flex-wrap gap-1">
                  {t.train.wagon_classes.map((c) => {
                    const free = c.free_seats > 0;
                    const isPicked =
                      seatSelection?.match.tripId === t.id &&
                      String(seatSelection?.match.classId) === String(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        disabled={!free}
                        onClick={() =>
                          openPicker({
                            tripId: t.id,
                            trainNumber: t.train.number,
                            classId: String(c.id),
                          })
                        }
                        title={free ? 'Обрати конкретні місця' : 'Немає вільних місць'}
                        aria-label={
                          isPicked
                            ? `${c.name}, обрано місця ${seatSelection!.seats.join(', ')}`
                            : free
                              ? `${c.name}, вільних місць: ${c.free_seats}. Обрати конкретні місця`
                              : `${c.name}, вільних місць немає`
                        }
                        className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium transition-colors ${
                          isPicked
                            ? 'bg-blue-600 text-white'
                            : free
                              ? 'bg-green-50 text-green-700 hover:bg-green-100'
                              : 'cursor-not-allowed bg-gray-100 text-gray-400'
                        }`}
                      >
                        {free ? <TicketIcon className="h-3 w-3" /> : null}
                        {c.name} ·{' '}
                        {isPicked
                          ? `місця ${seatSelection!.seats.join(', ')}`
                          : free
                            ? c.free_seats
                            : 'немає'}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : note ? (
        <p className="rounded-lg bg-gray-50 p-3 text-center text-xs text-gray-500">{note}</p>
      ) : null}

      {pickerMatch ? (
        <SeatPickerModal
          open={pickerOpen}
          match={pickerMatch}
          count={null}
          onClose={() => setPickerOpen(false)}
          onConfirm={(pick) => {
            onSelectSeats({
              match: pickerMatch,
              wagonNumber: pick.wagonNumber,
              seats: pick.seats,
            });
            setPickerOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
