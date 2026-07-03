import { useCallback, useEffect, useRef, useState } from 'react';
import { query } from '@/lib/messages';
import { useDebouncedSearch } from '@/lib/use-debounced-search';
import { Button, Field, Input } from '@/components/ui';
import { FloatingPanel } from './FloatingPanel';
import type { Station } from '@/lib/models';

function noteForCode(code?: string): string {
  if (code === 'not_discovered') return 'Пошук станцій ще недоступний — введіть ID станції вручну.';
  if (code === 'not_authenticated') return 'Залогіньтесь у booking.uz, щоб шукати станції.';
  return 'Помилка пошуку станцій.';
}

export function StationCombobox({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Station | null;
  onChange: (s: Station | null) => void;
}) {
  const [text, setText] = useState(value?.name ?? '');
  const [note, setNote] = useState<string | undefined>();
  const [manual, setManual] = useState(false);
  const [manualId, setManualId] = useState('');
  const anchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setText(value?.name ?? '');
  }, [value]);

  const fetchStations = useCallback(async (q: string): Promise<Station[] | null> => {
    const r = await query<Station[]>('stations', { query: q });
    if (r.ok && Array.isArray(r.data)) {
      setNote(undefined);
      return r.data;
    }
    setManual(true);
    setNote(noteForCode(r.code));
    return null;
  }, []);

  const { results, open, setOpen, change } = useDebouncedSearch(fetchStations);

  const pick = (s: Station): void => {
    onChange(s);
    setText(s.name);
    setOpen(false);
  };

  const applyManual = (): void => {
    const id = Number(manualId);
    if (Number.isInteger(id) && id > 0 && text.trim()) {
      onChange({ id, name: text.trim() });
    }
  };

  return (
    <Field label={label} hint={value ? `ID: ${value.id}` : note}>
      <div ref={anchorRef}>
        <Input
          value={text}
          placeholder="Назва станції…"
          onChange={(e) => {
            setText(e.target.value);
            onChange(null);
            change(e.target.value);
          }}
        />
      </div>
      <FloatingPanel
        anchorRef={anchorRef}
        open={open && results.length > 0}
        onClose={() => setOpen(false)}
        matchWidth
      >
        <ul className="max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl">
          {results.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm text-gray-800 hover:bg-blue-50"
                onClick={() => pick(s)}
              >
                {s.name}
              </button>
            </li>
          ))}
        </ul>
      </FloatingPanel>

      {manual ? (
        <div className="mt-1.5 flex items-center gap-2">
          <Input
            value={manualId}
            inputMode="numeric"
            placeholder="ID станції (напр. 2200001)"
            onChange={(e) => setManualId(e.target.value)}
          />
          <Button size="sm" onClick={applyManual}>
            OK
          </Button>
        </div>
      ) : null}
    </Field>
  );
}
