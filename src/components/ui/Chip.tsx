import { useRef } from 'react';
import type { ReactNode } from 'react';
import { pop } from '@/lib/ui/anim';

export function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const handleClick = () => {
    if (ref.current) pop(ref.current);
    onClick();
  };
  return (
    <button
      ref={ref}
      type="button"
      onClick={handleClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${
        active
          ? 'border-blue-600 bg-blue-600 text-white'
          : 'border-gray-300 bg-white text-gray-700 hover:border-blue-400 hover:bg-blue-50'
      }`}
    >
      {children}
    </button>
  );
}
