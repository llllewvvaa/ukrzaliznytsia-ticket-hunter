import { Chip, Field, Input } from '@/components/ui';
import { StationCombobox } from '@/components/StationCombobox';
import { DatePicker } from '@/components/DatePicker';
import { AddIcon, SwapIcon } from '@/components/icons';
import { todayPlus } from '@/lib/date';
import { QUICK_DATES } from '../constants';
import { HuntTypeToggle } from '../parts';
import type { NewJobFormState } from '../use-new-job-form';

export function StepRoute({ form }: { form: NewJobFormState }) {
  return (
    <div className="space-y-4">
      <HuntTypeToggle mode={form.mode} onSelect={form.selectType} />
      <StationCombobox label="Звідки" value={form.from} onChange={form.setFrom} />
      <div className="-my-2 flex justify-center">
        <button
          type="button"
          onClick={form.swapStations}
          aria-label="Поміняти напрямок місцями"
          className="grid h-9 w-9 place-items-center rounded-full border border-gray-200 bg-white text-blue-600 shadow-sm transition-transform duration-300 hover:bg-blue-50"
          style={{ transform: form.swapSpin ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <SwapIcon className="h-4 w-4" />
        </button>
      </div>
      <StationCombobox label="Куди" value={form.to} onChange={form.setTo} />

      <Field label="Дата поїздки">
        <DatePicker value={form.date} onChange={form.setDate} min={todayPlus(0)} />
      </Field>
      <div className="flex flex-wrap gap-1.5">
        {QUICK_DATES.map((q) => {
          const v = todayPlus(q.days);
          return (
            <Chip key={q.days} active={form.date === v} onClick={() => form.setDate(v)}>
              {q.label}
            </Chip>
          );
        })}
      </div>

      {form.showName ? (
        <Field label="Назва" hint="Необов'язково — згенерується автоматично">
          <Input
            autoFocus
            value={form.name}
            onChange={(e) => form.setName(e.target.value)}
            placeholder="напр. Відпустка"
          />
        </Field>
      ) : (
        <button
          type="button"
          onClick={() => form.setShowName(true)}
          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
        >
          <AddIcon className="h-4 w-4" /> Додати назву
        </button>
      )}
    </div>
  );
}
