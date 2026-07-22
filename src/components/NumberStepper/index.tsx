import { useRef } from 'react';
import type { ChangeEvent } from 'react';
import { pop } from '@/lib/ui/anim';
import { AddIcon, RemoveIcon } from '../icons';

export function NumberStepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  ariaLabel,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  ariaLabel?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);

  const clamp = (n: number): number => {
    let x = Number.isFinite(n) ? n : (min ?? 0);
    if (min != null) x = Math.max(min, x);
    if (max != null) x = Math.min(max, x);
    return x;
  };

  const bump = (delta: number): void => {
    onChange(clamp(value + delta));
    if (boxRef.current) pop(boxRef.current);
  };

  const handleDecrement = (): void => bump(-step);
  const handleIncrement = (): void => bump(step);
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>): void =>
    onChange(clamp(Number(e.target.value)));

  return (
    <div className="flex items-stretch overflow-hidden rounded-lg border border-gray-300 bg-white transition-colors focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/30">
      <button
        type="button"
        aria-label="Зменшити"
        onClick={handleDecrement}
        disabled={min != null && value <= min}
        className="grid w-9 place-items-center text-gray-500 transition-colors hover:bg-gray-50 active:bg-gray-100 disabled:opacity-30"
      >
        <RemoveIcon className="h-4 w-4" />
      </button>
      <div
        ref={boxRef}
        className="flex flex-1 items-center justify-center gap-1 border-x border-gray-200 px-2 text-sm text-gray-900"
      >
        <input
          type="number"
          aria-label={ariaLabel}
          value={value}
          min={min}
          max={max}
          onChange={handleInputChange}
          className="w-full [appearance:textfield] bg-transparent text-center outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        {suffix ? <span className="shrink-0 text-gray-400">{suffix}</span> : null}
      </div>
      <button
        type="button"
        aria-label="Збільшити"
        onClick={handleIncrement}
        disabled={max != null && value >= max}
        className="grid w-9 place-items-center text-gray-500 transition-colors hover:bg-gray-50 active:bg-gray-100 disabled:opacity-30"
      >
        <AddIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
