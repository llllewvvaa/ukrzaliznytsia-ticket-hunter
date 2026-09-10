import type { KeyboardEvent, ReactNode } from 'react';
import { HistoryIcon, SearchIcon, WatchIcon } from '../icons';
import type { Tab } from './types';

const SEG_TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'ways', label: 'Пошук', icon: <SearchIcon className="h-4 w-4" /> },
  { id: 'watches', label: 'Стеження', icon: <WatchIcon className="h-4 w-4" /> },
  { id: 'history', label: 'Історія', icon: <HistoryIcon className="h-4 w-4" /> },
];

export function SegTabs({ tab, onChange }: { tab: Tab; onChange: (next: Tab) => void }) {
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    const ids = SEG_TABS.map((item) => item.id);
    const index = ids.indexOf(tab);
    let next: number | null = null;
    if (event.key === 'ArrowRight') next = (index + 1) % ids.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + ids.length) % ids.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = ids.length - 1;
    if (next === null) return;
    event.preventDefault();
    onChange(ids[next]!);
  };

  const handleClick = (id: Tab) => (): void => onChange(id);

  return (
    <div
      role="tablist"
      aria-label="Розділи"
      className="mt-3 flex gap-1 rounded-2xl bg-white/60 p-1 shadow-sm ring-1 ring-black/5"
    >
      {SEG_TABS.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={tab === item.id}
          tabIndex={tab === item.id ? 0 : -1}
          onClick={handleClick(item.id)}
          onKeyDown={onKeyDown}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold transition-colors duration-200 ${
            tab === item.id ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </div>
  );
}
