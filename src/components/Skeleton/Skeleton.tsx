import { useEffect, useRef } from 'react';
import { shimmer } from '@/lib/ui/anim';

export function Skeleton({ className = '' }: { className?: string }) {
  const hl = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!hl.current) return;
    const tween = shimmer(hl.current);
    return () => {
      tween.kill();
    };
  }, []);
  return (
    <span
      aria-hidden="true"
      className={`relative block overflow-hidden rounded-md bg-gray-200 ${className}`}
    >
      <span
        ref={hl}
        className="absolute inset-0 block bg-gradient-to-r from-transparent via-white/70 to-transparent"
      />
    </span>
  );
}
