import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { moveHighlight } from './a11y';

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
  const [open, setOpenRaw] = useState(false);
  // Highlighted row for keyboard navigation; -1 = no highlight.
  const [highlight, setHighlight] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const active = useRef<SearchToken>({ aborted: false });

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      active.current.aborted = true;
    },
    [],
  );

  // Closing the panel always drops the highlight.
  const setOpen = useCallback((v: boolean): void => {
    setOpenRaw(v);
    if (!v) setHighlight(-1);
  }, []);

  const change = useCallback(
    (raw: string): void => {
      clearTimeout(timer.current);
      active.current.aborted = true; // supersede any in-flight request
      const token: SearchToken = { aborted: false };
      active.current = token;
      const q = raw.trim();
      if (q.length < minChars) {
        setResults([]);
        setOpenRaw(false);
        setHighlight(-1);
        return;
      }
      timer.current = setTimeout(() => {
        void fetcher(q, token).then((rows) => {
          if (token.aborted) return;
          if (rows && rows.length > 0) {
            setResults(rows);
            setOpenRaw(true);
            // Pre-highlight the first row so keyboard users see where they
            // are and Enter picks the top result right away.
            setHighlight(0);
          } else {
            setResults([]);
            setOpenRaw(false);
            setHighlight(-1);
          }
        });
      }, delayMs);
    },
    [fetcher, delayMs, minChars],
  );

  // Keyboard model for the combobox input: arrows cycle the highlight,
  // Enter picks the highlighted row, Escape closes the panel.
  const keydown = useCallback(
    (e: KeyboardEvent, pick: (item: T) => void): void => {
      if (!open || results.length === 0) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlight((h) => moveHighlight(h, e.key === 'ArrowDown' ? 1 : -1, results.length));
      } else if (e.key === 'Enter') {
        const row = highlight >= 0 ? results[highlight] : undefined;
        if (row !== undefined) {
          e.preventDefault();
          pick(row);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    },
    [open, results, highlight, setOpen],
  );

  return { results, open, setOpen, change, highlight, keydown };
}
