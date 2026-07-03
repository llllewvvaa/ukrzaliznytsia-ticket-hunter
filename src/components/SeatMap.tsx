import { useMemo } from 'react';
import { AcIcon, ToiletIcon } from './icons';
import { wagonCapacity } from '@/lib/seat-prefs';
import type { Wagon } from '@/lib/models';

export function SeatMap({
  wagon,
  selected,
  onToggle,
  maxReached,
}: {
  wagon: Wagon;
  selected: number[];
  onToggle: (seat: number) => void;
  maxReached: boolean;
}) {
  const free = useMemo(() => new Set(wagon.seats), [wagon]);
  const sel = new Set(selected);
  const capacity = wagonCapacity(wagon);
  const columns = Math.max(0, Math.ceil(capacity / 2));
  // even seat = upper berth, odd = lower
  const upperFree = wagon.seats.filter((s) => s % 2 === 0).length;
  const lowerFree = wagon.seats.filter((s) => s % 2 === 1).length;

  const renderSeat = (seat: number) => {
    if (seat > capacity) return <span key={seat} className="h-7 w-8" />;
    const isFree = free.has(seat);
    const isSel = sel.has(seat);
    const clickable = isFree && (isSel || !maxReached);
    return (
      <button
        key={seat}
        type="button"
        disabled={!clickable}
        onClick={() => onToggle(seat)}
        aria-pressed={isSel}
        className={`grid h-7 w-8 place-items-center rounded-md text-[11px] font-semibold tabular-nums transition-colors ${
          isSel
            ? 'bg-blue-600 text-white shadow-sm'
            : !isFree
              ? 'bg-gray-100 text-gray-300'
              : clickable
                ? 'border border-blue-300 bg-white text-blue-700 hover:bg-blue-50'
                : 'border border-gray-200 bg-white text-gray-300'
        }`}
      >
        {seat}
      </button>
    );
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-800">Вагон {wagon.number}</span>
        {wagon.air_conditioner ? <AcIcon className="h-4 w-4 text-blue-500" /> : null}
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500">
          Верхніх: {upperFree} · Нижніх: {lowerFree}
        </span>
      </div>
      <div className="overflow-x-auto pb-1">
        <div className="flex items-center gap-1">
          <ToiletIcon className="h-5 w-5 shrink-0 text-gray-300" />
          <div className="flex gap-1">
            {Array.from({ length: columns }, (_, i) => {
              const col = i + 1;
              return (
                <div
                  key={col}
                  className={`flex flex-col gap-1 ${col % 2 === 0 ? 'mr-2' : ''}`}
                >
                  {renderSeat(2 * col)}
                  {renderSeat(2 * col - 1)}
                </div>
              );
            })}
          </div>
          <ToiletIcon className="h-5 w-5 shrink-0 text-gray-300" />
        </div>
      </div>
    </div>
  );
}
