import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { moveSegment } from '@/lib/ui/anim';

// Slides a shared pill indicator under the active button of a segmented control.
// First run positions instantly; later changes animate. The buttons are flex-1,
// so when the container settles to its final width after mount (e.g. the side
// panel still animating open) the initial measurement goes stale — a
// ResizeObserver on the active button re-aligns the pill on geometry changes.
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
    let { offsetLeft: x, offsetWidth: w } = btn;

    // RO delivers an initial notification right on observe() — without the
    // geometry check that instant set stomps the slide tween on its first
    // frame and the pill visibly jumps. Re-position only on real changes.
    const ro = new ResizeObserver(() => {
      if (btn.offsetLeft === x && btn.offsetWidth === w) return;
      x = btn.offsetLeft;
      w = btn.offsetWidth;
      gsap.killTweensOf(el);
      moveSegment(el, btn, true);
    });
    ro.observe(btn);
    return () => ro.disconnect();
  }, [active]);

  // Stable ref callback per id — a fresh closure each render would detach and
  // re-attach every button's ref on any parent re-render.
  const setButtonRef = (id: T): ((el: HTMLButtonElement | null) => void) => {
    setters.current[id] ??= (el) => {
      btnRefs.current[id] = el;
    };
    return setters.current[id]!;
  };

  // Used by arrow-key navigation (tabs/radiogroup): move focus to a segment.
  const focusButton = (id: T): void => {
    btnRefs.current[id]?.focus();
  };

  return { indicatorRef, setButtonRef, focusButton };
}
