import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { hidePanel, revealPanel } from '@/lib/ui/anim';
import { focusableIn, isFocusable } from '@/lib/ui/a11y';

export function FloatingPanel<T extends HTMLElement>({
  anchorRef,
  open,
  onClose,
  matchWidth = false,
  grabFocus = false,
  children,
}: {
  anchorRef: RefObject<T | null>;
  open: boolean;
  onClose: () => void;
  matchWidth?: boolean;
  // Move focus into the panel on open (for dialog-like panels such as the
  // calendar). Combobox-style panels keep focus in the anchor input instead.
  grabFocus?: boolean;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({
    position: 'fixed',
    top: -9999,
    left: -9999,
    zIndex: 60,
  });

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  // Focus goes back to the anchor (or its first focusable child) — used when
  // the panel closes while focus is still inside it.
  const focusAnchor = useCallback((): void => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const target = isFocusable(anchor) ? anchor : focusableIn(anchor)[0];
    target?.focus({ preventScroll: true });
  }, [anchorRef]);

  const reposition = useCallback(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;
    const rect = anchor.getBoundingClientRect();
    const gap = 6;
    const width = matchWidth ? rect.width : panel.offsetWidth;
    const height = panel.offsetHeight || 300;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < height + gap && rect.top > spaceBelow;
    const top = openUp ? Math.max(gap, rect.top - gap - height) : rect.bottom + gap;
    const left = Math.max(gap, Math.min(rect.left, window.innerWidth - width - gap));
    setStyle((s) => ({ ...s, top, left, ...(matchWidth ? { width } : {}) }));
  }, [anchorRef, matchWidth]);

  useLayoutEffect(() => {
    if (!mounted) return;
    const el = panelRef.current;
    if (!el) return;
    if (open) {
      reposition();
      revealPanel(el);
      reposition();
      if (grabFocus) focusableIn(el)[0]?.focus({ preventScroll: true });
    } else {
      // Closing: never leave focus stranded inside an unmounting portal.
      if (el.contains(document.activeElement)) focusAnchor();
      hidePanel(el, () => setMounted(false));
    }
  }, [open, mounted, reposition, grabFocus, focusAnchor]);

  useEffect(() => {
    if (!open) return;
    const handler = (): void => reposition();
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent): void => {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      // Focus is still inside the panel (e.g. a calendar day): hand it back to
      // the anchor. A click on another focusable overrides this via its own
      // default focus behaviour, so we never steal it.
      if (panelRef.current?.contains(document.activeElement)) focusAnchor();
      onClose();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, onClose, anchorRef, focusAnchor]);

  if (!mounted) return null;
  return createPortal(
    <div ref={panelRef} style={style}>
      {children}
    </div>,
    document.body,
  );
}
