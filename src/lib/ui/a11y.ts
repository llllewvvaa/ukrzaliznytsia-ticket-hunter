// Matches natively focusable elements; disabled controls and tabindex="-1"
// are excluded so traps/highlights never land on dead stops.
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
}

export function isFocusable(el: Element): el is HTMLElement {
  return el instanceof HTMLElement && el.matches(FOCUSABLE);
}

// Cyclic highlight movement for listbox-style widgets (comboboxes, selects).
// -1 means "no highlight yet": Down lands on the first row, Up on the last.
export function moveHighlight(current: number, delta: number, length: number): number {
  if (length <= 0) return -1;
  if (current < 0 || current >= length) return delta > 0 ? 0 : length - 1;
  return (current + delta + length) % length;
}
