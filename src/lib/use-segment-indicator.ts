import { useLayoutEffect, useRef } from 'react';
import { moveSegment } from './anim';

// Slides a shared pill indicator under the active button of a segmented control.
// First run positions instantly; later changes animate.
export function useSegmentIndicator<T extends string>(active: T) {
  const indicatorRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Partial<Record<T, HTMLButtonElement | null>>>({});
  const inited = useRef(false);

  useLayoutEffect(() => {
    const el = indicatorRef.current;
    const btn = btnRefs.current[active];
    if (!el || !btn) return;
    moveSegment(el, btn, !inited.current);
    inited.current = true;
  }, [active]);

  const setButtonRef = (id: T) => (el: HTMLButtonElement | null) => {
    btnRefs.current[id] = el;
  };

  return { indicatorRef, setButtonRef };
}
