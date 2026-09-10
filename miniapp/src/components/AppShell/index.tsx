import type { ReactNode } from 'react';
import { SegTabs } from './SegTabs';
import type { Tab } from './types';

export function AppShell({
  tab,
  onTabChange,
  online,
  children,
}: {
  tab: Tab;
  onTabChange: (next: Tab) => void;
  online: boolean;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto min-h-screen w-full max-w-2xl px-3 pb-10 pt-3">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900 text-xs font-bold text-white">
            УЗ
          </span>
          <span className="text-sm font-semibold text-gray-900">Сторож квитків</span>
        </div>
        <span
          className={`h-2.5 w-2.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-gray-300'}`}
          aria-label={online ? 'сервер на звʼязку' : 'сервер недоступний'}
        />
      </header>

      <SegTabs tab={tab} onChange={onTabChange} />

      <main className="mt-3 space-y-3">{children}</main>

      <footer className="mt-6 text-center text-[11px] leading-relaxed text-gray-400">
        Лише стежить і сповіщає. Не бронює й не оплачує.
      </footer>
    </div>
  );
}
