import type { ReactNode } from 'react';
import { Button, Chip, Toggle } from '@/components/ui';
import { JobCard } from '@/components/JobCard';
import { SeatMap } from '@/components/SeatMap';
import { EmptyState } from '@/components/EmptyState';
import {
  AddIcon,
  CalendarIcon,
  CheckIcon,
  HoldIcon,
  LowerBerthIcon,
  SidebarIcon,
  SwapIcon,
  UpperBerthIcon,
} from '@/components/icons';
import { demoJobs, demoReservedJob, demoSeatSelection, demoWagon } from './mockData';

const noop = (): void => {};

export function HuntsScreen() {
  return (
    <div className="flex flex-col gap-3">
      <Button variant="primary" size="lg" className="w-full">
        <AddIcon className="h-5 w-5" /> Створити пошук
      </Button>
      <span className="px-1 text-xs text-gray-500">2 пошуки</span>
      <div className="space-y-3">
        {demoJobs().map((j) => (
          <JobCard key={j.id} job={j} onControl={noop} />
        ))}
      </div>
    </div>
  );
}

export function RouteScreen() {
  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <FieldMock label="Звідки" value="Київ" />
        <span className="mb-2 grid h-8 w-8 shrink-0 place-items-center rounded-md text-gray-400">
          <SwapIcon className="h-5 w-5" />
        </span>
        <FieldMock label="Куди" value="Львів" />
      </div>
      <FieldMock label="Дата" value="19.07.2026" icon={<CalendarIcon className="h-4 w-4" />} />
      <ChipGroup label="Поїзди" chips={['057К', '091Л', '119О']} />
      <ChipGroup label="Типи вагонів" chips={['Купе', 'Плацкарт', 'Люкс']} />
      <Button variant="primary" className="w-full">
        Далі
      </Button>
    </div>
  );
}

export function SeatsScreen() {
  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
          Вподобання місць
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Chip active onClick={noop}>
            <span className="inline-flex items-center gap-1">
              <LowerBerthIcon className="h-4 w-4" /> Нижнє
            </span>
          </Chip>
          <Chip active={false} onClick={noop}>
            <span className="inline-flex items-center gap-1">
              <UpperBerthIcon className="h-4 w-4" /> Верхнє
            </span>
          </Chip>
        </div>
        <Toggle
          checked
          onChange={noop}
          label="Подалі від туалету"
          hint="Автовибір: спершу центр, потім початок, потім кінець"
        />
        <Toggle checked onChange={noop} label="Кондиціонер" />
      </div>
      <SeatMap wagon={demoWagon} selected={demoSeatSelection} onToggle={noop} maxReached={false} />
    </div>
  );
}

export function PassengersScreen() {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-xs font-semibold text-gray-700">Режим</p>
        <div className="grid grid-cols-2 gap-2">
          <ModeCard active title="Моніторинг" desc="Стежити 24/7" />
          <ModeCard active={false} title="Запланований" desc="До відкриття продажу" />
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-semibold text-gray-700">Пасажири</p>
        <div className="space-y-2">
          <PassengerRow checked name="Іван Тестенко" tag="Дорослий" />
          <PassengerRow checked name="Олена Тестенко" tag="Дорослий" />
          <PassengerRow checked={false} name="Петро Тестенко" tag="Дитячий" />
        </div>
        <p className="mt-2 text-xs font-medium text-green-600">Обрано 2 — вистачає на 2 місця</p>
      </div>
    </div>
  );
}

export function ReserveScreen() {
  return (
    <div className="space-y-3">
      <JobCard job={demoReservedJob()} onControl={noop} />
      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-snug text-amber-800">
        <HoldIcon className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Місця тримаються ~15 хвилин. Натисніть «Кошик», завершіть оплату на booking.uz —
          reCAPTCHA проходите ви.
        </span>
      </div>
    </div>
  );
}

export function SettingsScreen() {
  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Бічна панель</p>
        <Toggle
          checked
          onChange={noop}
          label="Відкривати бічну панель за кліком на іконку"
          hint="Панель лишається відкритою поряд з booking.uz."
        />
        <Button size="sm">
          <SidebarIcon className="h-4 w-4" /> Відкрити зараз у бічній панелі
        </Button>
      </div>
      <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Дебаг-запис</p>
        <Toggle
          checked={false}
          onChange={noop}
          label="Записувати запити та події"
          hint="Для діагностики. Експорт у файл — без паролів."
        />
        <div className="flex gap-2">
          <Button size="sm">Експортувати</Button>
          <Button size="sm" variant="danger">
            Очистити
          </Button>
        </div>
      </div>
    </div>
  );
}

export function DoneScreen() {
  return (
    <div className="flex h-full items-center justify-center">
      <EmptyState onNew={noop} />
    </div>
  );
}

function FieldMock({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="min-w-0 flex-1 space-y-1.5">
      <span className="block text-xs font-semibold tracking-wide text-gray-700">{label}</span>
      <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
        {icon ? <span className="text-gray-400">{icon}</span> : null}
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}

function ChipGroup({ label, chips }: { label: string; chips: string[] }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-gray-700">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c, i) => (
          <Chip key={c} active={i === 0} onClick={noop}>
            {c}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function ModeCard({ active, title, desc }: { active: boolean; title: string; desc: string }) {
  return (
    <div
      className={`rounded-xl border p-3 text-left ${
        active ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white'
      }`}
    >
      <p className={`text-sm font-semibold ${active ? 'text-blue-700' : 'text-gray-800'}`}>
        {title}
      </p>
      <p className="mt-0.5 text-xs text-gray-500">{desc}</p>
    </div>
  );
}

function PassengerRow({ checked, name, tag }: { checked: boolean; name: string; tag: string }) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${
        checked ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="min-w-0">
        <p className="truncate text-sm text-gray-800">{name}</p>
        <p className="text-xs text-gray-400">{tag}</p>
      </div>
      <span
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border text-white ${
          checked ? 'border-blue-600 bg-blue-600' : 'border-gray-300 bg-white'
        }`}
      >
        {checked ? <CheckIcon className="h-3.5 w-3.5" /> : null}
      </span>
    </div>
  );
}
