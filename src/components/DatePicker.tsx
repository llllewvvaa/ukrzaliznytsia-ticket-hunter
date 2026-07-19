import { useEffect, useRef, useState, type RefObject } from 'react';
import { FloatingPanel } from './FloatingPanel';
import { BackIcon, CalendarIcon, ForwardIcon } from './icons';

const MONTHS = [
  'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень',
];
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

const DEFAULT_HOUR = 8;
const TIME_ROW_PX = 28; // h-7 — keep in sync with the time-column buttons

const pad = (n: number): string => String(n).padStart(2, '0');
const toIso = (y: number, m: number, d: number): string => `${y}-${pad(m + 1)}-${pad(d)}`;

interface DateValue {
  y: number;
  m: number;
  d: number;
  hh: number;
  mm: number;
}

// Parses 'YYYY-MM-DD' and 'YYYY-MM-DDTHH:mm'; time defaults to 08:00 when absent.
function parseValue(s: string): DateValue | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(s);
  if (!match) return null;
  return {
    y: Number(match[1]),
    m: Number(match[2]) - 1,
    d: Number(match[3]),
    hh: match[4] !== undefined ? Number(match[4]) : DEFAULT_HOUR,
    mm: match[5] !== undefined ? Number(match[5]) : 0,
  };
}

function formatValue(s: string, withTime: boolean): string {
  const p = parseValue(s);
  if (!p) return withTime ? 'Оберіть дату й час' : 'Оберіть дату';
  const date = `${pad(p.d)}.${pad(p.m + 1)}.${p.y}`;
  return withTime ? `${date}, ${pad(p.hh)}:${pad(p.mm)}` : date;
}

function TimeColumn({
  label,
  count,
  selected,
  onPick,
  boxRef,
}: {
  label: string;
  count: number;
  selected: number;
  onPick: (n: number) => void;
  boxRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="w-10">
      <div className="mb-1 text-center text-[10px] font-medium text-gray-400">{label}</div>
      <div ref={boxRef} className="h-48 overflow-y-auto rounded-lg border border-gray-100">
        {Array.from({ length: count }, (_, n) => (
          <button
            key={n}
            type="button"
            onClick={() => onPick(n)}
            aria-pressed={n === selected}
            className={`block h-7 w-full text-center text-sm tabular-nums transition-colors ${
              n === selected
                ? 'bg-blue-600 font-semibold text-white'
                : 'text-gray-700 hover:bg-blue-50'
            }`}
          >
            {pad(n)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function DatePicker({
  value,
  onChange,
  min,
  withTime = false,
}: {
  value: string;
  onChange: (v: string) => void;
  min?: string;
  withTime?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hoursBoxRef = useRef<HTMLDivElement>(null);
  const minutesBoxRef = useRef<HTMLDivElement>(null);

  const now = new Date();
  const minParsed = min ? parseValue(min) : null;
  const minDate = minParsed
    ? new Date(minParsed.y, minParsed.m, minParsed.d)
    : new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const initial = parseValue(value) ?? {
    y: now.getFullYear(),
    m: now.getMonth(),
    d: now.getDate(),
    hh: DEFAULT_HOUR,
    mm: 0,
  };
  const [vy, setVy] = useState(initial.y);
  const [vm, setVm] = useState(initial.m);
  const [hh, setHh] = useState(initial.hh);
  const [mm, setMm] = useState(initial.mm);

  const openCalendar = (): void => {
    const p = parseValue(value);
    if (p) {
      setVy(p.y);
      setVm(p.m);
      setHh(p.hh);
      setMm(p.mm);
    }
    setOpen(true);
  };

  // Center the selected hour/minute in the scroll columns when the panel opens.
  useEffect(() => {
    if (!open || !withTime) return;
    const center = (box: HTMLDivElement | null, idx: number): void => {
      if (box) box.scrollTop = Math.max(0, idx * TIME_ROW_PX - (box.clientHeight - TIME_ROW_PX) / 2);
    };
    center(hoursBoxRef.current, hh);
    center(minutesBoxRef.current, mm);
    // hh/mm are synced from value on open — only re-center per open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, withTime]);

  const firstWeekday = (new Date(vy, vm, 1).getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(vy, vm + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const canPrev = new Date(vy, vm, 1) > new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  const goPrev = (): void => {
    if (!canPrev) return;
    if (vm === 0) {
      setVy(vy - 1);
      setVm(11);
    } else setVm(vm - 1);
  };
  const goNext = (): void => {
    if (vm === 11) {
      setVy(vy + 1);
      setVm(0);
    } else setVm(vm + 1);
  };

  const sel = parseValue(value);
  const isDisabled = (d: number): boolean => new Date(vy, vm, d) < minDate;

  const emit = (iso: string, h: number, mins: number): void => {
    if (!withTime) {
      onChange(iso);
      return;
    }
    let v = `${iso}T${pad(h)}:${pad(mins)}`;
    // zero-padded ISO datetimes compare chronologically
    if (min && v < min) v = min;
    onChange(v);
  };

  const pick = (d: number): void => {
    if (isDisabled(d)) return;
    emit(toIso(vy, vm, d), hh, mm);
    if (!withTime) setOpen(false);
  };

  const changeTime = (h: number, mins: number): void => {
    setHh(h);
    setMm(mins);
    if (sel) emit(toIso(sel.y, sel.m, sel.d), h, mins);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openCalendar())}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-900 outline-none transition-colors hover:border-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
      >
        <span>{formatValue(value, withTime)}</span>
        <CalendarIcon className="h-4 w-4 shrink-0 text-gray-400" />
      </button>

      <FloatingPanel anchorRef={triggerRef} open={open} onClose={() => setOpen(false)} grabFocus>
        <div className="rounded-xl border border-gray-200 bg-white p-2.5 shadow-xl">
          <div className="flex gap-2">
            <div className={withTime ? 'w-60' : 'w-64'}>
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={!canPrev}
                  aria-label="Попередній місяць"
                  className="grid h-7 w-7 place-items-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-30"
                >
                  <BackIcon className="h-4 w-4" />
                </button>
                <span className="text-sm font-semibold text-gray-800">
                  {MONTHS[vm] ?? ''} {vy}
                </span>
                <button
                  type="button"
                  onClick={goNext}
                  aria-label="Наступний місяць"
                  className="grid h-7 w-7 place-items-center rounded-md text-gray-500 transition-colors hover:bg-gray-100"
                >
                  <ForwardIcon className="h-4 w-4" />
                </button>
              </div>

              <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium text-gray-400">
                {WEEKDAYS.map((w) => (
                  <span key={w}>{w}</span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-0.5">
                {cells.map((d, i) =>
                  d === null ? (
                    <span key={`blank-${i}`} />
                  ) : (
                    <button
                      key={d}
                      type="button"
                      onClick={() => pick(d)}
                      disabled={isDisabled(d)}
                      className={`grid h-8 place-items-center rounded-md text-sm transition-colors ${
                        sel && sel.y === vy && sel.m === vm && sel.d === d
                          ? 'bg-blue-600 font-semibold text-white'
                          : isDisabled(d)
                            ? 'text-gray-300'
                            : 'text-gray-700 hover:bg-blue-50'
                      }`}
                    >
                      {d}
                    </button>
                  ),
                )}
              </div>
            </div>

            {withTime ? (
              <div className="flex gap-1 border-l border-gray-100 pl-2">
                <TimeColumn
                  label="Година"
                  count={24}
                  selected={hh}
                  onPick={(n) => changeTime(n, mm)}
                  boxRef={hoursBoxRef}
                />
                <TimeColumn
                  label="Хвилини"
                  count={60}
                  selected={mm}
                  onPick={(n) => changeTime(hh, n)}
                  boxRef={minutesBoxRef}
                />
              </div>
            ) : null}
          </div>

          {withTime ? (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-2.5 w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Готово
            </button>
          ) : null}
        </div>
      </FloatingPanel>
    </>
  );
}
