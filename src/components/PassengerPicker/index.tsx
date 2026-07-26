import { useRef } from 'react';
import type { ChangeEvent } from 'react';
import { Field, Input } from '@/components/ui';
import { pop } from '@/lib/ui/anim';
import { usePassengers } from '@/hooks/use-passengers';
import { CheckIcon } from '../icons';
import { SkeletonRows } from '../Skeleton';
import type { Passenger } from '@/lib/models';

export function PassengerPicker({
  value,
  onChange,
}: {
  value: number[];
  onChange: (ids: number[]) => void;
}) {
  const { passengers, note } = usePassengers();

  const toggle = (id: number): void => {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  };

  const setManual = (raw: string): void => {
    const ids = raw
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0);
    onChange(Array.from(new Set(ids)));
  };

  const handlePassengerToggle = (id: number) => (): void => toggle(id);

  const onManualChange = (e: ChangeEvent<HTMLInputElement>): void => setManual(e.target.value);

  return (
    <Field label="Пасажири" hint={note}>
      {passengers === null ? (
        <SkeletonRows count={3} />
      ) : passengers.length > 0 ? (
        <div className="flex flex-col gap-1">
          {passengers.map((p) => (
            <PassengerRow
              key={p.id}
              passenger={p}
              selected={value.includes(p.id)}
              onToggle={handlePassengerToggle(p.id)}
            />
          ))}
        </div>
      ) : (
        <Input
          placeholder="ID пасажирів через кому (напр. 2000001, 2000002)"
          defaultValue={value.join(', ')}
          onChange={onManualChange}
        />
      )}
    </Field>
  );
}

function PassengerRow({
  passenger,
  selected,
  onToggle,
}: {
  passenger: Passenger;
  selected: boolean;
  onToggle: () => void;
}) {
  const boxRef = useRef<HTMLSpanElement>(null);

  const handleClick = (): void => {
    onToggle();
    if (boxRef.current) pop(boxRef.current);
  };

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      onClick={handleClick}
      className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
        selected ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'
      }`}
    >
      <span
        ref={boxRef}
        className={`grid h-5 w-5 shrink-0 place-items-center rounded border transition-colors ${
          selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 bg-white'
        }`}
      >
        {selected ? <CheckIcon className="h-3.5 w-3.5" /> : null}
      </span>
      <span className="text-gray-800">
        {passenger.first_name} {passenger.last_name}
      </span>
      <span className="ml-auto text-xs text-gray-400">#{passenger.id}</span>
    </button>
  );
}
