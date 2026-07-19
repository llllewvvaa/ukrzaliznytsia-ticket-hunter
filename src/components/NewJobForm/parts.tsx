import type { KeyboardEvent, ReactNode } from 'react';
import { useSegmentIndicator } from '@/lib/use-segment-indicator';
import type { JobMode } from '@/lib/models';
import { HuntIcon, ScheduleIcon } from '@/components/icons';

export function IconLabel({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {icon}
      {text}
    </span>
  );
}

export function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-gray-500">{label}</dt>
      <dd className="text-right font-semibold text-gray-800">{value}</dd>
    </div>
  );
}

const HUNT_TYPES: { id: JobMode; title: string; desc: string; icon: ReactNode }[] = [
  { id: 'monitor', title: 'Стежити зараз', desc: 'Поїзд у продажу', icon: <HuntIcon className="h-4 w-4" /> },
  { id: 'scheduled', title: 'До відкриття', desc: 'Продажі ще ні', icon: <ScheduleIcon className="h-4 w-4" /> },
];

export function HuntTypeToggle({ mode, onSelect }: { mode: JobMode; onSelect: (m: JobMode) => void }) {
  const { indicatorRef, setButtonRef, focusButton } = useSegmentIndicator(mode);

  // WAI-ARIA radiogroup: arrows move selection and focus together.
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>): void => {
    const ids = HUNT_TYPES.map((t) => t.id);
    const i = ids.indexOf(mode);
    let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % ids.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + ids.length) % ids.length;
    if (next === null) return;
    e.preventDefault();
    const id = ids[next]!;
    onSelect(id);
    focusButton(id);
  };

  return (
    <div className="relative flex gap-2 rounded-2xl bg-gray-100 p-1" role="radiogroup" aria-label="Тип пошуку">
      <div
        ref={indicatorRef}
        className="pointer-events-none absolute inset-y-1 left-0 w-0 rounded-xl bg-white shadow-sm ring-1 ring-blue-200"
        aria-hidden
      />
      {HUNT_TYPES.map((t) => {
        const active = mode === t.id;
        return (
          <button
            key={t.id}
            ref={setButtonRef(t.id)}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onSelect(t.id)}
            onKeyDown={onKeyDown}
            className="relative z-10 flex flex-1 flex-col items-start gap-0.5 rounded-xl px-3 py-2 text-left transition-colors"
          >
            <span
              className={`inline-flex items-center gap-1.5 text-sm font-semibold transition-colors ${
                active ? 'text-blue-700' : 'text-gray-600'
              }`}
            >
              {t.icon}
              {t.title}
            </span>
            <span className="text-[11px] text-gray-400">{t.desc}</span>
          </button>
        );
      })}
    </div>
  );
}
