import { useLayoutEffect, useRef } from 'react';
import { moveSegment } from './anim';

// Slides a shared pill indicator under the active button of a segmented control.
// First run positions instantly; later changes animate.
export function useSegmentIndicator<T extends string>(active: T) {
  const indicatorRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Partial<Record<T, HTMLButtonElement | null>>>({});
  const setters = useRef<Partial<Record<T, (el: HTMLButtonElement | null) => void>>>({});
  const inited = useRef(false);

  useLayoutEffect(() => {
    const el = indicatorRef.current;
    const btn = btnRefs.current[active];
    if (!el || !btn) return;
    moveSegment(el, btn, !inited.current);
    inited.current = true;
  }, [active]);

  // Stable ref callback per id — a fresh closure each render would detach and
  // re-attach every button's ref on any parent re-render.
  const setButtonRef = (id: T): ((el: HTMLButtonElement | null) => void) => {
    setters.current[id] ??= (el) => {
      btnRefs.current[id] = el;
    };
    return setters.current[id]!;
  };

  return { indicatorRef, setButtonRef };
}
