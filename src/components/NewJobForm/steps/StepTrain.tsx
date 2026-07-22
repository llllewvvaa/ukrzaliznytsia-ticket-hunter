import { Chip, Field } from '@/components/ui';
import { TrainPicker } from '@/components/TrainPicker';
import { TimetablePicker } from '@/components/TimetablePicker';
import { COACH_TYPES } from '../constants';
import type { CoachType } from '@/lib/models';
import type { NewJobFormState } from '../types';

export function StepTrain({ form }: { form: NewJobFormState }) {
  const { seatSelection } = form;

  const handleCoachToggle = (id: CoachType) => (): void => form.toggleCoach(id);
  return (
    <div className="space-y-4">
      {form.mode === 'scheduled' ? (
        <Field
          label="Поїзд із розкладу"
          hint="Оберіть станції в розкладі УЗ (передзаповнено з маршруту) — список поїздів доступний ще до відкриття продажу"
        >
          <TimetablePicker
            seedFrom={form.from?.name}
            seedTo={form.to?.name}
            value={form.trains}
            onChange={form.setTrains}
          />
        </Field>
      ) : (
        <Field
          label="Поїзди на цю дату"
          hint="Оберіть зі списку, натисніть клас вагона щоб обрати місця, або лишіть порожнім = будь-який"
        >
          <TrainPicker
            from={form.from}
            to={form.to}
            date={form.date}
            value={form.trains}
            onChange={form.setTrains}
            seatSelection={seatSelection}
            onSelectSeats={form.handleSelectSeats}
            onClearSeats={() => form.setSeatSelection(null)}
          />
        </Field>
      )}

      {!seatSelection ? (
        <Field label="Типи вагонів" hint="Порожньо = будь-який; порядок задає пріоритет">
          <div className="flex flex-wrap gap-2">
            {COACH_TYPES.map((c) => (
              <Chip
                key={c.id}
                active={form.coachTypes.includes(c.id)}
                onClick={handleCoachToggle(c.id)}
              >
                {c.id} · {c.name}
              </Chip>
            ))}
          </div>
        </Field>
      ) : (
        <p className="rounded-2xl bg-blue-50 p-3 text-xs leading-relaxed text-blue-700">
          Ви обрали конкретні місця (вагон {seatSelection.wagonNumber} ·{' '}
          {seatSelection.seats.join(', ')}). Типи вагонів і преференції місць ігноруються. Додайте
          стільки ж пасажирів, скільки місць ({seatSelection.seats.length}) — по одному на кожне.
        </p>
      )}
    </div>
  );
}
