import gsap from 'gsap';

function reduced(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function stepIn(el: Element, dir: 'next' | 'back'): void {
  if (reduced()) return;
  gsap.fromTo(
    el,
    { autoAlpha: 0, x: dir === 'next' ? 22 : -22 },
    { autoAlpha: 1, x: 0, duration: 0.28, ease: 'power2.out' },
  );
}

export function shake(el: Element): void {
  if (reduced()) return;
  gsap.fromTo(el, { x: -8 }, { x: 0, duration: 0.6, ease: 'elastic.out(1, 0.25)' });
}

export function pop(el: Element): void {
  if (reduced()) return;
  gsap.fromTo(el, { scale: 0.86 }, { scale: 1, duration: 0.25, ease: 'back.out(3)' });
}

export function moveSegment(indicator: HTMLElement, target: HTMLElement, instant = false): void {
  const to = { x: target.offsetLeft, width: target.offsetWidth };
  if (instant || reduced()) {
    gsap.set(indicator, to);
    return;
  }
  gsap.to(indicator, { ...to, duration: 0.34, ease: 'power3.out' });
}

export function revealPanel(el: HTMLElement): void {
  el.style.display = 'block';
  if (reduced()) {
    gsap.set(el, { autoAlpha: 1, y: 0, scaleY: 1 });
    return;
  }
  gsap.fromTo(
    el,
    { autoAlpha: 0, y: -6, scaleY: 0.96 },
    {
      autoAlpha: 1,
      y: 0,
      scaleY: 1,
      duration: 0.18,
      ease: 'power2.out',
      transformOrigin: 'top center',
    },
  );
}

export function hidePanel(el: HTMLElement, done?: () => void): void {
  gsap.killTweensOf(el);
  if (reduced()) {
    el.style.display = 'none';
    done?.();
    return;
  }
  gsap.to(el, {
    autoAlpha: 0,
    y: -6,
    duration: 0.12,
    ease: 'power2.in',
    onComplete: () => {
      el.style.display = 'none';
      done?.();
    },
  });
}

export function dialogIn(backdrop: HTMLElement, card: HTMLElement): void {
  gsap.killTweensOf([backdrop, card]);
  if (reduced()) {
    gsap.set(backdrop, { autoAlpha: 1 });
    gsap.set(card, { autoAlpha: 1, y: 0, scale: 1 });
    return;
  }
  gsap.fromTo(backdrop, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2, ease: 'power2.out' });
  gsap.fromTo(
    card,
    { autoAlpha: 0, y: 14, scale: 0.94 },
    { autoAlpha: 1, y: 0, scale: 1, duration: 0.34, ease: 'back.out(1.6)' },
  );
}

export function dialogOut(backdrop: HTMLElement, card: HTMLElement, done: () => void): void {
  gsap.killTweensOf([backdrop, card]);
  if (reduced()) {
    done();
    return;
  }
  gsap.to(card, { autoAlpha: 0, y: 8, scale: 0.96, duration: 0.16, ease: 'power2.in' });
  gsap.to(backdrop, { autoAlpha: 0, duration: 0.2, ease: 'power2.in', onComplete: done });
}

export function staggerIn(items: NodeListOf<Element> | Element[]): void {
  if (reduced()) return;
  gsap.fromTo(
    items,
    { autoAlpha: 0, y: -4 },
    { autoAlpha: 1, y: 0, duration: 0.15, stagger: 0.025, ease: 'power2.out', delay: 0.02 },
  );
}

export function onboardingReveal(mock: Element, copy: NodeListOf<Element> | Element[]): void {
  if (reduced()) return;
  gsap.fromTo(
    mock,
    { autoAlpha: 0, y: 16, scale: 0.985 },
    { autoAlpha: 1, y: 0, scale: 1, duration: 0.5, ease: 'power3.out' },
  );
  gsap.fromTo(
    copy,
    { autoAlpha: 0, y: 12 },
    { autoAlpha: 1, y: 0, duration: 0.42, stagger: 0.06, ease: 'power2.out', delay: 0.06 },
  );
}

export function onboardingStep(items: Element[]): void {
  if (reduced() || items.length === 0) return;
  gsap.fromTo(
    items,
    { autoAlpha: 0, y: 10 },
    { autoAlpha: 1, y: 0, duration: 0.3, stagger: 0.05, ease: 'power2.out' },
  );
}

export function shimmer(el: Element): ReturnType<typeof gsap.fromTo> {
  const tween = gsap.fromTo(
    el,
    { xPercent: -100 },
    { xPercent: 100, duration: 1.1, ease: 'power1.inOut', repeat: -1, repeatDelay: 0.15 },
  );
  if (reduced()) tween.pause();
  return tween;
}

export function collapse(el: HTMLElement, open: boolean, instant = false): void {
  gsap.killTweensOf(el);
  if (instant || reduced()) {
    gsap.set(el, { height: open ? 'auto' : 0, autoAlpha: open ? 1 : 0 });
    return;
  }
  // Tween an explicit px height (scrollHeight ignores the overflow cap), then release to auto.
  const full = el.scrollHeight;
  if (open) {
    gsap.fromTo(
      el,
      { height: 0, autoAlpha: 0 },
      {
        height: full,
        autoAlpha: 1,
        duration: 0.32,
        ease: 'power3.out',
        onComplete: () => gsap.set(el, { height: 'auto' }),
      },
    );
  } else {
    gsap.fromTo(
      el,
      { height: full, autoAlpha: 1 },
      { height: 0, autoAlpha: 0, duration: 0.26, ease: 'power3.inOut' },
    );
  }
}
