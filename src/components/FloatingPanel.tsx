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
import { hidePanel, revealPanel } from '@/lib/anim';

export function FloatingPanel<T extends HTMLElement>({
  anchorRef,
  open,
  onClose,
  matchWidth = false,
  children,
}: {
  anchorRef: RefObject<T | null>;
  open: boolean;
  onClose: () => void;
  matchWidth?: boolean;
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
    } else {
      hidePanel(el, () => setMounted(false));
    }
  }, [open, mounted, reposition]);

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
    const onDoc = (e: MouseEvent): void => {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, onClose, anchorRef]);

  if (!mounted) return null;
  return createPortal(
    <div ref={panelRef} style={style}>
      {children}
    </div>,
    document.body,
  );
}
