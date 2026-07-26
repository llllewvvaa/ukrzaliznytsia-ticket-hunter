import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { Chip, Input } from '@/components/ui';
import { SkeletonRows } from '@/components/Skeleton';
import { CloseIcon, ForwardIcon, SearchIcon } from '@/components/icons';
import { staggerIn } from '@/lib/ui/anim';
import { useTimetableTrains } from '@/hooks/use-timetable';
import { departLabel } from '@/lib/format/trip-format';
import type { TimetableStation } from '@/lib/format/timetable';
import { TimetableStationInput } from './TimetableStationInput';

export function TimetablePicker({
  seedFrom,
  seedTo,
  value,
  onChange,
}: {
  seedFrom?: string;
  seedTo?: string;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [from, setFrom] = useState<TimetableStation | null>(null);
  const [to, setTo] = useState<TimetableStation | null>(null);
  const { trains, loading, note, manual, setManual } = useTimetableTrains(from, to);
  const [manualNum, setManualNum] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (trains?.length && listRef.current) {
      staggerIn(listRef.current.querySelectorAll('[data-tt]'));
    }
  }, [trains]);

  const toggle = (num: string): void =>
    onChange(value.includes(num) ? value.filter((n) => n !== num) : [...value, num]);

  const addManual = (): void => {
    const n = manualNum.trim();
    if (n && !value.includes(n)) onChange([...value, n]);
    setManualNum('');
  };

  // Enter must not bubble up and submit the surrounding wizard form.
  const onManualKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addManual();
    }
  };

  const onManualNumChange = (e: ChangeEvent<HTMLInputElement>): void =>
    setManualNum(e.target.value);

  const handleTrainToggle = (num: string) => (): void => toggle(num);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2">
        <TimetableStationInput
          label="Звідки (розклад)"
          value={from}
          onChange={setFrom}
          seedName={seedFrom}
        />
        <TimetableStationInput
          label="Куди (розклад)"
          value={to}
          onChange={setTo}
          seedName={seedTo}
        />
      </div>

      {loading ? <SkeletonRows count={3} /> : null}

      {!loading && trains?.length ? (
        <div ref={listRef} className="space-y-2">
          {trains.map((t) => {
            const on = value.includes(t.number);
            return (
              <button
                key={t.number}
                type="button"
                data-tt
                aria-pressed={on}
                onClick={handleTrainToggle(t.number)}
                className={`w-full rounded-2xl border p-3 text-left transition ${
                  on
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-900">Поїзд {t.number}</span>
                  <span className="text-sm font-semibold text-gray-700">{departLabel(t)}</span>
                </div>
                <div className="mt-0.5 text-xs text-gray-500">
                  {t.route}
                  {t.boardings[0]?.station ? ` · від ${t.boardings[0].station}` : ''}
                </div>
                {t.periodicity[0] ? (
                  <div className="mt-1 text-[11px] leading-snug text-gray-400">
                    {t.periodicity.join('; ')}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {note ? <p className="text-xs text-amber-700">{note}</p> : null}

      {manual ? (
        <div className="flex gap-2">
          <Input
            value={manualNum}
            onChange={onManualNumChange}
            onKeyDown={onManualKeyDown}
            placeholder="Номер поїзда, напр. 66 або 043К"
          />
          <button
            type="button"
            onClick={addManual}
            aria-label="Додати номер"
            className="grid shrink-0 place-items-center rounded-xl bg-blue-600 px-3 text-white hover:bg-blue-700"
          >
            <ForwardIcon className="h-5 w-5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setManual(true)}
          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
        >
          <SearchIcon className="h-4 w-4" /> Ввести номер вручну
        </button>
      )}

      {value.length ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((n) => (
            <Chip key={n} active onClick={handleTrainToggle(n)}>
              <span className="inline-flex items-center gap-1">
                Поїзд {n} <CloseIcon className="h-3.5 w-3.5" />
              </span>
            </Chip>
          ))}
        </div>
      ) : null}
    </div>
  );
}
