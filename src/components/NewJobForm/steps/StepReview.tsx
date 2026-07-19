import { Field, Input } from '@/components/ui';
import { DatePicker } from '@/components/DatePicker';
import { NumberStepper } from '@/components/NumberStepper';
import { ScheduleIcon } from '@/components/icons';
import { localDateTimeIso } from '@/lib/date';
import { FORM_BOUNDS } from '@/lib/job-factory';
import { SummaryRow } from '../parts';
import type { NewJobFormState } from '../use-new-job-form';

export function StepReview({ form }: { form: NewJobFormState }) {
  const { seatSelection } = form;
  return (
    <div className="space-y-4">
      {form.mode === 'scheduled' ? (
        <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
          <Field
            label="Коли відкриваються продажі"
            hint="Типово — за 20 днів до поїздки о 08:00. За вашим годинником — о цьому часі почнеться суб-секундний спринт"
          >
            <DatePicker
              withTime
              value={form.startAt}
              onChange={form.setStartAt}
              min={localDateTimeIso()}
            />
          </Field>
          <p className="flex items-start gap-2 rounded-2xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
            <ScheduleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Тримайте розширення відкритим до старту (найкраще — бічну панель, вона не
              закривається), а комп'ютер — активним. Одразу після відкриття бот почне ловити квитки з
              наявних вагонів.
            </span>
          </p>
        </div>
      ) : (
        <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
          <Field
            label="Інтервал перевірки"
            hint={`Як часто перевіряти наявність · ${FORM_BOUNDS.monitorMinSec}–${FORM_BOUNDS.monitorMaxSec} с`}
          >
            <NumberStepper
              value={form.pollIntervalSec}
              onChange={form.setPollIntervalSec}
              min={FORM_BOUNDS.monitorMinSec}
              max={FORM_BOUNDS.monitorMaxSec}
              suffix="с"
              ariaLabel="Інтервал перевірки в секундах"
            />
          </Field>
          <Field label="Максимум спроб" hint="Необов'язково — без обмеження, якщо порожньо">
            <Input
              type="number"
              min={1}
              value={form.maxAttempts}
              onChange={(e) => form.setMaxAttempts(e.target.value)}
              placeholder="без обмеження"
            />
          </Field>
        </div>
      )}

      <dl className="space-y-2 rounded-2xl border border-gray-200 bg-white p-4 text-sm">
        <SummaryRow
          label="Режим"
          value={form.mode === 'scheduled' ? 'Заплановане до відкриття' : 'Моніторинг'}
        />
        <SummaryRow label="Маршрут" value={`${form.from?.name ?? '—'} → ${form.to?.name ?? '—'}`} />
        <SummaryRow label="Дата" value={form.date} />
        {form.mode === 'scheduled' ? (
          <SummaryRow
            label="Старт продажу"
            value={form.startAt ? new Date(form.startAt).toLocaleString() : 'не вказано'}
          />
        ) : null}
        <SummaryRow label="Поїзди" value={form.trains.length ? form.trains.join(', ') : 'будь-який'} />
        <SummaryRow
          label="Місця"
          value={
            seatSelection
              ? `вагон ${seatSelection.wagonNumber} · ${seatSelection.seats.join(', ')}`
              : form.coachTypes.length
                ? form.coachTypes.join(', ')
                : 'будь-який вагон'
          }
        />
        <SummaryRow label="Пасажири" value={String(form.passengerIds.length)} />
      </dl>
    </div>
  );
}
