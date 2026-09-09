import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import type { Station } from './types.js';

export function StationPicker({
  label,
  value,
  onPick,
}: {
  label: string;
  value: Station | null;
  onPick: (station: Station | null) => void;
}) {
  const [query, setQuery] = useState(value?.name ?? '');
  const [options, setOptions] = useState<Station[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (query.length < 2 || (value && query === value.name)) {
      setOptions([]);
      return;
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      api
        .stations(query)
        .then((res) => {
          setOptions(res.stations.slice(0, 8));
          setOpen(true);
        })
        .catch(() => setOptions([]));
    }, 350);
    return () => window.clearTimeout(timer.current);
  }, [query, value]);

  return (
    <div className="suggest">
      <label>{label}</label>
      <input
        value={query}
        placeholder="назва станції"
        onChange={(event) => {
          setQuery(event.target.value);
          onPick(null);
        }}
        onFocus={() => setOpen(options.length > 0)}
      />
      {open && options.length > 0 && (
        <ul>
          {options.map((station) => (
            <li
              key={station.id}
              onClick={() => {
                onPick(station);
                setQuery(station.name);
                setOpen(false);
              }}
            >
              {station.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
