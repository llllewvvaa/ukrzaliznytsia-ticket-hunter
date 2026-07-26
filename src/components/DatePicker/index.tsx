import { useRef, type RefObject } from 'react';
import { FloatingPanel } from '../FloatingPanel';
import { BackIcon, CalendarIcon, ForwardIcon } from '../icons';
import { canPrevMonth, formatValue, monthCells, parseValue, toIso } from '@/lib/format/date';
import { useDatePicker } from '@/hooks/use-date-picker';

const MONTHS = [
  'Січень',
  'Лютий',
  'Березень',
  'Квітень',
  'Травень',
  'Червень',
  'Липень',
  'Серпень',
  'Вересень',
  'Жовтень',
  'Листопад',
  'Грудень',
];
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];

const pad = (n: number): string => String(n).padStart(2, '0');

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
  const handlePick = (n: number) => (): void => onPick(n);

  return (
    <div className="w-10">
      <div className="mb-1 text-center text-[10px] font-medium text-gray-400">{label}</div>
      <div ref={boxRef} className="h-48 overflow-y-auto rounded-lg border border-gray-100">
        {Array.from({ length: count }, (_, n) => (
          <button
            key={n}
            type="button"
            onClick={handlePick(n)}
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const {
    open,
    setOpen,
    openCalendar,
    vy,
    setVy,
    vm,
    setVm,
    hh,
    setHh,
    mm,
    setMm,
    hoursBoxRef,
    minutesBoxRef,
  } = useDatePicker(value, withTime);

  const now = new Date();
  const minParsed = min ? parseValue(min) : null;
  const minDate = minParsed
    ? new Date(minParsed.y, minParsed.m, minParsed.d)
    : new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const cells = monthCells(vy, vm);

  const canPrev = canPrevMonth(vy, vm, minDate);
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

  const handleTriggerClick = (): void => {
    if (open) setOpen(false);
    else openCalendar();
  };

  const pickDay = (d: number) => (): void => pick(d);

  const changeHour = (n: number): void => changeTime(n, mm);

  const changeMinute = (n: number): void => changeTime(hh, n);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleTriggerClick}
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
                      onClick={pickDay(d)}
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
                  onPick={changeHour}
                  boxRef={hoursBoxRef}
                />
                <TimeColumn
                  label="Хвилини"
                  count={60}
                  selected={mm}
                  onPick={changeMinute}
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
