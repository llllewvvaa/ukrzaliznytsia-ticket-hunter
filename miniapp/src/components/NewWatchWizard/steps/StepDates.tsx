import { Field, Input } from '../../ui';
import { dateRange } from '../../../lib/format';
import type { WizardState } from '../types';

export function StepDates({
  state,
  dateTo,
  patch,
}: {
  state: WizardState;
  dateTo: string;
  patch: (next: Partial<WizardState>) => void;
}) {
  return (
    <div className="space-y-4">
      <Field label="Перший день">
        <Input
          type="date"
          value={state.dateFrom}
          onChange={(event) => patch({ dateFrom: event.target.value })}
        />
      </Field>
      <Field label="Скільки днів поспіль" hint="Кожен день — окрема одиниця перебору.">
        <Input
          type="number"
          min={1}
          max={14}
          value={state.days}
          onChange={(event) =>
            patch({ days: Math.max(1, Math.min(14, Number(event.target.value))) })
          }
        />
      </Field>
      <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
        Вікно: {dateRange(state.dateFrom, dateTo)}
      </p>
    </div>
  );
}
