import type { ReactNode } from 'react';

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{title}</h3>
      {children}
    </section>
  );
}
