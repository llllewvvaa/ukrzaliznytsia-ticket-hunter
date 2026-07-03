import { useCallback, useEffect, useRef, useState } from 'react';
import { Chip, Field, Input } from '@/components/ui';
import { FloatingPanel } from './FloatingPanel';
import { SkeletonRows } from '@/components/Skeleton';
import { CloseIcon, ForwardIcon, SearchIcon } from '@/components/icons';
import { query } from '@/lib/messages';
import { staggerIn } from '@/lib/anim';
import { useDebouncedSearch } from '@/lib/use-debounced-search';
import { pickBestStation, stationQueryCandidates } from '@/lib/timetable';
import type { TimetableStation, TimetableTrain } from '@/lib/timetable';

function departLabel(t: TimetableTrain): string {
  const dep = t.boardings[0]?.departTime ?? '';
  if (dep && t.arriveTime) return `${dep} → ${t.arriveTime}`;
  return dep || t.arriveTime || '';
}

function TimetableStationInput({
  label,
  value,
  onChange,
  seedName,
}: {
  label: string;
  value: TimetableStation | null;
  onChange: (s: TimetableStation | null) => void;
  seedName?: string;
}) {
  const [text, setText] = useState(value?.name ?? '');
  const anchorRef = useRef<HTMLDivElement>(null);
  const seeded = useRef(false);

  const fetchStations = useCallback(async (q: string): Promise<TimetableStation[] | null> => {
    const r = await query<TimetableStation[]>('timetableStations', { q });
    return r.ok && Array.isArray(r.data) ? r.data : null;
  }, []);

  const { results, open, setOpen, change } = useDebouncedSearch(fetchStations);

  // Timetable has its own id space; seed from booking.uz name but keep editable.
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
  }, [seedName, value, onChange]);

  const pick = (s: TimetableStation): void => {
    onChange(s);
    setText(s.name);
    setOpen(false);
  };

  return (
    <Field label={label}>
      <div ref={anchorRef}>
        <Input
          value={text}
          placeholder="Станція в розкладі УЗ…"
          onChange={(e) => {
            setText(e.target.value);
            onChange(null);
            change(e.target.value);
          }}
        />
      </div>
      <FloatingPanel
        anchorRef={anchorRef}
        open={open && results.length > 0}
        onClose={() => setOpen(false)}
        matchWidth
      >
        <ul className="max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl">
          {results.map((s) => (
            <li key={s.ids}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-blue-50"
                onClick={() => pick(s)}
              >
                {s.name}
              </button>
            </li>
          ))}
        </ul>
      </FloatingPanel>
    </Field>
  );
}

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
  const [trains, setTrains] = useState<TimetableTrain[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState<string | undefined>();
  const [manual, setManual] = useState(false);
  const [manualNum, setManualNum] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

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
                onClick={() => toggle(t.number)}
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
            onChange={(e) => setManualNum(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addManual();
              }
            }}
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
            <Chip key={n} active onClick={() => toggle(n)}>
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
