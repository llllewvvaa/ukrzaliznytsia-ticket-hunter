import { useEffect } from 'react';
import type { RefObject } from 'react';
import gsap from 'gsap';

const COLORS = ['#f59e0b', '#3b82f6', '#8b5cf6', '#ef4444', '#10b981', '#fcd34d', '#ec4899'];
const COUNT = 150;

// One-shot burst: particles are appended to `containerRef`, flung up and out,
// then fall and remove themselves. No cleanup on unmount — the tweens own
// their elements and dispose of them on completion.
export function useConfetti(containerRef: RefObject<HTMLDivElement | null>, active: boolean): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!active || !container) return;

    const elements: HTMLDivElement[] = [];
    for (let i = 0; i < COUNT; i++) {
      const el = document.createElement('div');
      const isCircle = Math.random() > 0.5;
      el.style.position = 'absolute';
      el.style.width = isCircle ? '10px' : '8px';
      el.style.height = isCircle ? '10px' : '16px';
      el.style.backgroundColor = COLORS[Math.floor(Math.random() * COLORS.length)]!;
      el.style.borderRadius = isCircle ? '50%' : '2px';
      el.style.top = '100px';
      el.style.left = '50%';
      el.style.zIndex = '10000';
      el.style.opacity = '0';
      container.appendChild(el);
      elements.push(el);
    }

    for (const el of elements) {
      const angle = Math.random() * Math.PI - Math.PI / 2; // -90..+90 deg around straight up
      const velocity = 300 + Math.random() * 500;

      gsap.fromTo(
        el,
        { x: 0, y: 0, opacity: 1, scale: Math.random() * 0.5 + 0.5 },
        {
          x: Math.sin(angle) * velocity,
          y: -Math.cos(angle) * velocity + Math.random() * 200,
          rotation: Math.random() * 720 - 360,
          rotationX: Math.random() * 720 - 360,
          rotationY: Math.random() * 720 - 360,
          duration: 0.8 + Math.random() * 0.5,
          ease: 'power3.out',
          onComplete: () => {
            gsap.to(el, {
              y: window.innerHeight + 100,
              x: `+=${Math.sin(angle) * 100}`,
              rotation: `+=${Math.random() * 360}`,
              duration: 1.5 + Math.random() * 1.5,
              ease: 'power1.in',
              opacity: 0,
              onComplete: () => el.remove(),
            });
          },
        },
      );
    }
  }, [active, containerRef]);
}
