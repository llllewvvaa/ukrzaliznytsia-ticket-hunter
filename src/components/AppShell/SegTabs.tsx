import type { KeyboardEvent, ReactNode } from 'react';
import { useSegmentIndicator } from '@/hooks/use-segment-indicator';
import { HuntIcon, OrdersIcon, SettingsIcon } from '@/components/icons';
import type { Tab } from './types';

const SEG_TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'hunts', label: 'Пошук', icon: <HuntIcon className="h-4 w-4" /> },
  { id: 'orders', label: 'Квитки', icon: <OrdersIcon className="h-4 w-4" /> },
  { id: 'settings', label: 'Налашт.', icon: <SettingsIcon className="h-4 w-4" /> },
];

export function SegTabs({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const { indicatorRef, setButtonRef, focusButton } = useSegmentIndicator(tab);

  // WAI-ARIA tabs: arrows move selection and focus together, Home/End jump.
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>): void => {
    const ids = SEG_TABS.map((t) => t.id);
    const i = ids.indexOf(tab);
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = (i + 1) % ids.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + ids.length) % ids.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = ids.length - 1;
    if (next === null) return;
    e.preventDefault();
    const id = ids[next]!;
    onChange(id);
    focusButton(id);
  };

  const handleTabClick = (id: Tab) => (): void => onChange(id);

  return (
    <div
      role="tablist"
      aria-label="Розділи"
      className="relative mt-3 flex gap-1 rounded-2xl bg-white/60 p-1 shadow-sm ring-1 ring-black/5"
    >
      <div
        ref={indicatorRef}
        className="pointer-events-none absolute inset-y-1 left-0 w-0 rounded-xl bg-blue-600 shadow-sm"
        aria-hidden
      />
      {SEG_TABS.map((t) => (
        <button
          key={t.id}
          ref={setButtonRef(t.id)}
          type="button"
          role="tab"
          aria-selected={tab === t.id}
          tabIndex={tab === t.id ? 0 : -1}
          onClick={handleTabClick(t.id)}
          onKeyDown={onKeyDown}
          className={`relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold transition-colors duration-200 ${
            tab === t.id ? 'text-white' : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}
