import { useCallback, useEffect, useRef, useState } from 'react';

// Debounced typeahead: owns the results/open state and the trailing timer.
// `fetcher` resolves to rows (opens the panel) or null (closes it); it may run
// its own side effects for error copy. Below `minChars` the panel is cleared.
export function useDebouncedSearch<T>(
  fetcher: (q: string) => Promise<T[] | null>,
  opts: { delayMs?: number; minChars?: number } = {},
) {
  const { delayMs = 300, minChars = 2 } = opts;
  const [results, setResults] = useState<T[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const change = useCallback(
    (raw: string): void => {
      clearTimeout(timer.current);
      const q = raw.trim();
      if (q.length < minChars) {
        setResults([]);
        setOpen(false);
        return;
      }
      timer.current = setTimeout(() => {
        void fetcher(q).then((rows) => {
          if (rows && rows.length > 0) {
            setResults(rows);
            setOpen(true);
          } else {
            setResults([]);
            setOpen(false);
          }
        });
      }, delayMs);
    },
    [fetcher, delayMs, minChars],
  );

  return { results, open, setOpen, change };
}
