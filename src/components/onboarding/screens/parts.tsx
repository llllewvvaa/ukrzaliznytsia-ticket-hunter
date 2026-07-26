import type { ReactNode } from 'react';
import { Chip } from '@/components/ui';
import { CheckIcon } from '@/components/icons';

// Demo screens render real but dead controls — every handler is this noop.
export const noop = (): void => {};

export function FieldMock({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <div className="min-w-0 flex-1 space-y-1.5">
      <span className="block text-xs font-semibold tracking-wide text-gray-700">{label}</span>
      <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
        {icon ? <span className="text-gray-400">{icon}</span> : null}
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}

export function ChipGroup({ label, chips }: { label: string; chips: string[] }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-gray-700">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c, i) => (
          <Chip key={c} active={i === 0} onClick={noop}>
            {c}
          </Chip>
        ))}
      </div>
    </div>
  );
}

export function ModeCard({
  active,
  title,
  desc,
}: {
  active: boolean;
  title: string;
  desc: string;
}) {
  return (
    <div
      className={`rounded-xl border p-3 text-left ${
        active ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white'
      }`}
    >
      <p className={`text-sm font-semibold ${active ? 'text-blue-700' : 'text-gray-800'}`}>
        {title}
      </p>
      <p className="mt-0.5 text-xs text-gray-500">{desc}</p>
    </div>
  );
}

export function PassengerRow({
  checked,
  name,
  tag,
}: {
  checked: boolean;
  name: string;
  tag: string;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${
        checked ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="min-w-0">
        <p className="truncate text-sm text-gray-800">{name}</p>
        <p className="text-xs text-gray-400">{tag}</p>
      </div>
      <span
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border text-white ${
          checked ? 'border-blue-600 bg-blue-600' : 'border-gray-300 bg-white'
        }`}
      >
        {checked ? <CheckIcon className="h-3.5 w-3.5" /> : null}
      </span>
    </div>
  );
}
