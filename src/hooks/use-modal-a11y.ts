import { useEffect, useRef, type RefObject } from 'react';
import { focusableIn } from '@/lib/ui/a11y';

// Modal dialog behaviour shared by ConfirmDialog and SeatPickerModal:
// moves focus inside on open, traps Tab/Shift+Tab within the card, closes on
// Escape and returns focus to whatever was focused before the dialog opened.
// `active` should be `open && mounted` so the card is guaranteed to be in the
// DOM (both dialogs mount one render after `open` flips, to animate in).
export function useModalA11y(
  cardRef: RefObject<HTMLElement | null>,
  active: boolean,
  onClose: () => void,
): void {
  const returnFocusTo = useRef<HTMLElement | null>(null);
  // Keep the latest onClose without re-running the trap on every parent
  // render (callers pass inline arrows).
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const card = cardRef.current;
    if (!card) return;

    returnFocusTo.current = document.activeElement as HTMLElement | null;
    (focusableIn(card)[0] ?? card).focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusableIn(card);
      if (items.length === 0) {
        e.preventDefault();
        card.focus({ preventScroll: true });
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const focused = document.activeElement;
      if (e.shiftKey && (focused === first || focused === card || !card.contains(focused))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (focused === last || !card.contains(focused))) {
        e.preventDefault();
        first.focus();
      }
    };
    // Capture phase: the trap must win over other window-level key handlers
    // (e.g. a FloatingPanel Escape listener underneath the dialog).
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      const to = returnFocusTo.current;
      returnFocusTo.current = null;
      if (to && document.contains(to)) to.focus({ preventScroll: true });
    };
  }, [active, cardRef]);
}
