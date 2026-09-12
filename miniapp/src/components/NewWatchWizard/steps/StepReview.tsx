import { Chip } from '../../ui';
import { dateRange } from '../../../lib/format';
import { CLASS_OPTIONS } from '../../../types';
import type { WizardState } from '../types';

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-gray-100 py-2 text-sm last:border-none">
      <span className="text-gray-500">{label}</span>
      <span className="text-right font-medium text-gray-900">{value}</span>
    </div>
  );
}

export function StepReview({
  state,
  dateTo,
  patch,
}: {
  state: WizardState;
  dateTo: string;
  patch: (next: Partial<WizardState>) => void;
}) {
  const classes =
    state.classes.length === 0
      ? 'будь-який'
      : state.classes.map((id) => CLASS_OPTIONS.find((o) => o.id === id)?.title ?? id).join(', ');
  const seats: string[] = [];
  if (state.berth === 'lower') seats.push('нижня полиця');
  if (state.berth === 'upper') seats.push('верхня полиця');
  if (state.minSeats > 1) seats.push(`${state.minSeats} місця`);
  if (state.adjacent) seats.push('поруч');

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <SummaryRow label="Маршрут" value={`${state.from?.name ?? ''} → ${state.to?.name ?? ''}`} />
        <SummaryRow label="Дати" value={dateRange(state.dateFrom, dateTo)} />
        <SummaryRow label="Класи" value={classes} />
        <SummaryRow label="Стеля ціни" value={state.maxPrice ? `${state.maxPrice} грн` : 'немає'} />
        <SummaryRow label="Місця" value={seats.length > 0 ? seats.join(' · ') : 'будь-які'} />
        <SummaryRow
          label="Вийти раніше"
          value={state.alightEarlierMin > 0 ? `якщо до мети до ${state.alightEarlierMin} хв` : 'ні'}
        />
      </div>

      <Chip active={state.favorite} onClick={() => patch({ favorite: !state.favorite })}>
        Додати в улюблені
      </Chip>
      <p className="text-xs leading-relaxed text-gray-500">
        Улюблені перевіряються частіше й мають гарантований шматок бюджету запитів.
      </p>
    </div>
  );
}
