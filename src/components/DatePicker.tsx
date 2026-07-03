import { useRef, useState } from 'react';
import { FloatingPanel } from './FloatingPanel';
import { BackIcon, CalendarIcon, ForwardIcon } from './icons';

const MONTHS = [
  'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
  'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень',
];
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

const pad = (n: number): string => String(n).padStart(2, '0');
const toIso = (y: number, m: number, d: number): string => `${y}-${pad(m + 1)}-${pad(d)}`;

function parseIso(s: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) };
}

function formatIso(s: string): string {
  const p = parseIso(s);
  return p ? `${pad(p.d)}.${pad(p.m + 1)}.${p.y}` : 'Оберіть дату';
}

export function DatePicker({
  value,
  onChange,
  min,
}: {
  value: string;
  onChange: (iso: string) => void;
  min?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const now = new Date();
  const minParsed = min ? parseIso(min) : null;
  const minDate = minParsed
    ? new Date(minParsed.y, minParsed.m, minParsed.d)
    : new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const initial = parseIso(value) ?? { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };
  const [vy, setVy] = useState(initial.y);
  const [vm, setVm] = useState(initial.m);

  const openCalendar = (): void => {
    const p = parseIso(value);
    if (p) {
      setVy(p.y);
      setVm(p.m);
    }
    setOpen(true);
  };

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

  const sel = parseIso(value);
  const isDisabled = (d: number): boolean => new Date(vy, vm, d) < minDate;
  const pick = (d: number): void => {
    if (isDisabled(d)) return;
    onChange(toIso(vy, vm, d));
    setOpen(false);
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
        <span>{formatIso(value)}</span>
        <CalendarIcon className="h-4 w-4 shrink-0 text-gray-400" />
      </button>

      <FloatingPanel anchorRef={triggerRef} open={open} onClose={() => setOpen(false)}>
        <div className="w-64 rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
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
      </FloatingPanel>
    </>
  );
}
