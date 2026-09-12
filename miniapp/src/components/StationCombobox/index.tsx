import { useState } from 'react';
import { Input } from '../ui';
import { useStationSearch } from '../../hooks/use-station-search';
import type { Station } from '../../types';

export function StationCombobox({
  label,
  placeholder,
  value,
  onPick,
}: {
  label: string;
  placeholder: string;
  value: Station | null;
  onPick: (station: Station | null) => void;
}) {
  const [query, setQuery] = useState(value?.name ?? '');
  const [open, setOpen] = useState(false);
  const picked = value != null && query === value.name;
  const { options, busy } = useStationSearch(query, picked);

  const handleChange = (next: string): void => {
    setQuery(next);
    setOpen(true);
    if (value) onPick(null);
  };

  const handlePick = (station: Station) => (): void => {
    onPick(station);
    setQuery(station.name);
    setOpen(false);
  };

  return (
    <div className="relative">
      <span className="block text-xs font-semibold tracking-wide text-gray-700">{label}</span>
      <Input
        className="mt-1.5"
        value={query}
        placeholder={placeholder}
        onChange={(event) => handleChange(event.target.value)}
        onFocus={() => setOpen(options.length > 0)}
      />
      {busy ? <span className="mt-1 block text-[11px] text-gray-400">шукаю станцію…</span> : null}
      {open && options.length > 0 ? (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
          {options.map((station) => (
            <li key={station.id}>
              <button
                type="button"
                onClick={handlePick(station)}
                className="w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-blue-50"
              >
                {station.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
