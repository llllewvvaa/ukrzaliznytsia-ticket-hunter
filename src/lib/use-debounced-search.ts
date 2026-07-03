import { useCallback, useEffect, useRef, useState } from 'react';

// Marks a request stale once a newer keystroke supersedes it. Fetchers check
// `token.aborted` after their await so out-of-order responses are dropped.
export type SearchToken = { aborted: boolean };

// Debounced typeahead: owns the results/open state and the trailing timer.
// `fetcher` resolves to rows (opens the panel) or null (closes it); it may run
// its own side effects for error copy, guarded by the same token. Below
// `minChars` the panel is cleared.
export function useDebouncedSearch<T>(
  fetcher: (q: string, token: SearchToken) => Promise<T[] | null>,
  opts: { delayMs?: number; minChars?: number } = {},
) {
  const { delayMs = 300, minChars = 2 } = opts;
  const [results, setResults] = useState<T[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const active = useRef<SearchToken>({ aborted: false });

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      active.current.aborted = true;
    },
    [],
  );

  const change = useCallback(
    (raw: string): void => {
      clearTimeout(timer.current);
      active.current.aborted = true; // supersede any in-flight request
      const token: SearchToken = { aborted: false };
      active.current = token;
      const q = raw.trim();
      if (q.length < minChars) {
        setResults([]);
        setOpen(false);
        return;
      }
      timer.current = setTimeout(() => {
        void fetcher(q, token).then((rows) => {
          if (token.aborted) return;
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
