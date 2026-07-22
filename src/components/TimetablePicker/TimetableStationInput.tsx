import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { Field, Input } from '@/components/ui';
import { FloatingPanel } from '@/components/FloatingPanel';
import { query } from '@/lib/messages';
import { useDebouncedSearch, type SearchToken } from '@/hooks/use-debounced-search';
import { useTimetableSeed } from '@/hooks/use-timetable';
import { createSearchInputChange } from '@/lib/ui/search-input';
import type { TimetableStation } from '@/lib/format/timetable';

export function TimetableStationInput({
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

  const fetchStations = useCallback(
    async (q: string, token: SearchToken): Promise<TimetableStation[] | null> => {
      const r = await query<TimetableStation[]>('timetableStations', { q });
      if (token.aborted) return null;
      return r.ok && Array.isArray(r.data) ? r.data : null;
    },
    [],
  );

  const { results, open, setOpen, change, highlight, keydown } = useDebouncedSearch(fetchStations);
  const listId = useId();

  // Keep the keyboard-highlighted option visible inside the scrollable list.
  useEffect(() => {
    if (highlight < 0) return;
    document.getElementById(`${listId}-${highlight}`)?.scrollIntoView({ block: 'nearest' });
  }, [highlight, listId]);

  useTimetableSeed(value, seedName, onChange, setText);

  const pick = (s: TimetableStation): void => {
    onChange(s);
    setText(s.name);
    setOpen(false);
  };

  const onInputChange = createSearchInputChange({ setText, onChange, change });

  const onInputKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => keydown(e, pick);

  // keep focus in the input
  const keepInputFocus = (e: MouseEvent<HTMLLIElement>): void => e.preventDefault();

  const handleOptionClick = (s: TimetableStation) => (): void => pick(s);

  return (
    <Field label={label}>
      <div ref={anchorRef}>
        <Input
          value={text}
          placeholder="Станція в розкладі УЗ…"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && results.length > 0}
          aria-controls={listId}
          aria-activedescendant={highlight >= 0 ? `${listId}-${highlight}` : undefined}
          onChange={onInputChange}
          onKeyDown={onInputKeyDown}
        />
      </div>
      <FloatingPanel
        anchorRef={anchorRef}
        open={open && results.length > 0}
        onClose={() => setOpen(false)}
        matchWidth
      >
        <ul
          role="listbox"
          id={listId}
          aria-label={label}
          className="max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl"
        >
          {results.map((s, i) => (
            <li
              key={s.ids}
              role="option"
              id={`${listId}-${i}`}
              aria-selected={i === highlight}
              className={`cursor-pointer px-3 py-2 text-sm hover:bg-blue-100 ${
                i === highlight ? 'bg-blue-100 font-medium text-blue-900' : 'text-gray-800'
              }`}
              onMouseDown={keepInputFocus}
              onClick={handleOptionClick(s)}
            >
              {s.name}
            </li>
          ))}
        </ul>
      </FloatingPanel>
    </Field>
  );
}
