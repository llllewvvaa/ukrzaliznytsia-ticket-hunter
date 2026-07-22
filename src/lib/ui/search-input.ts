import type { ChangeEvent } from 'react';

// Typing in a station combobox clears the current pick and starts a fresh
// debounced search — one behavior shared by every station input.
export function createSearchInputChange<T>(deps: {
  setText: (text: string) => void;
  onChange: (value: T | null) => void;
  change: (text: string) => void;
}): (e: ChangeEvent<HTMLInputElement>) => void {
  return (e) => {
    deps.setText(e.target.value);
    deps.onChange(null);
    deps.change(e.target.value);
  };
}
