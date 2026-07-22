import type { ReactNode } from 'react';

export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">
      {children}
    </span>
  );
}
