import type { ReactNode } from 'react';
import { HuntIcon, OrdersIcon, SettingsIcon, SidebarIcon, TicketIcon } from '@/components/icons';

type Tab = 'hunts' | 'orders' | 'settings';

export function PopupFrame({
  activeTab = 'hunts',
  authOk = true,
  children,
}: {
  activeTab?: Tab;
  authOk?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex h-[600px] w-[400px] flex-col overflow-hidden rounded-[24px] border border-gray-200 bg-gray-50 text-sm text-gray-900 shadow-2xl ring-1 ring-black/5">
      <header className="border-b border-gray-200 bg-gradient-to-br from-blue-50 to-indigo-50 px-4 pb-3 pt-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TicketIcon className="h-5 w-5 text-blue-600" />
            <h1 className="text-base font-bold text-gray-900">Ticket Hunter</h1>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                authOk ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${authOk ? 'bg-green-500' : 'bg-gray-400'}`} />
              {authOk ? 'Сесія активна' : 'Немає сесії'}
            </span>
            <span className="grid h-7 w-7 place-items-center rounded-md text-gray-400">
              <SidebarIcon className="h-5 w-5" />
            </span>
          </div>
        </div>

        <div className="mt-3 flex gap-1 rounded-2xl bg-white/70 p-1 shadow-sm ring-1 ring-black/5">
          <FrameTab active={activeTab === 'hunts'} icon={<HuntIcon className="h-4 w-4" />} label="Пошук" />
          <FrameTab active={activeTab === 'orders'} icon={<OrdersIcon className="h-4 w-4" />} label="Квитки" />
          <FrameTab
            active={activeTab === 'settings'}
            icon={<SettingsIcon className="h-4 w-4" />}
            label="Налашт."
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-gradient-to-b from-indigo-50/30 to-transparent p-4">
        {children}
      </div>

      <footer className="border-t border-gray-200 bg-white px-4 py-2 text-center text-[11px] text-gray-400">
        Лише для особистого використання. Оплату завершуйте вручну.
      </footer>
    </div>
  );
}

function FrameTab({ active, icon, label }: { active: boolean; icon: ReactNode; label: string }) {
  return (
    <span
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold ${
        active ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500'
      }`}
    >
      {icon} {label}
    </span>
  );
}
