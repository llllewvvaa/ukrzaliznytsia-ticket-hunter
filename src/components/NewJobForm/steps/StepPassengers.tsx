import { Toggle } from '@/components/ui';
import { PassengerPicker } from '@/components/PassengerPicker';
import { BeddingIcon } from '@/components/icons';
import { IconLabel } from '../parts';
import type { NewJobFormState } from '../use-new-job-form';

export function StepPassengers({ form }: { form: NewJobFormState }) {
  const { seatSelection } = form;
  return (
    <div className="space-y-4">
      <PassengerPicker value={form.passengerIds} onChange={form.setPassengerIds} />
      {seatSelection ? (
        <p
          className={`rounded-2xl p-3 text-xs leading-relaxed ${
            form.passengerIds.length === seatSelection.seats.length
              ? 'bg-green-50 text-green-700'
              : 'bg-amber-50 text-amber-800'
          }`}
        >
          Для обраних місць ({seatSelection.seats.join(', ')}) потрібно рівно{' '}
          {seatSelection.seats.length} — по одному пасажиру на місце. Обрано{' '}
          {form.passengerIds.length}.
        </p>
      ) : null}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <Toggle
          checked={form.bedding}
          onChange={form.setBedding}
          label={<IconLabel icon={<BeddingIcon className="h-4 w-4" />} text="Постіль" />}
          hint="Для нічних поїздів"
        />
      </div>
    </div>
  );
}
