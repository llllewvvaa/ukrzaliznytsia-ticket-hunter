import { Button } from '@/components/ui';
import { BackIcon, PlayIcon } from '@/components/icons';
import type { HuntJob } from '@/lib/models';
import { STEPS } from './constants';
import { useNewJobForm } from './use-new-job-form';
import { StepRoute } from './steps/StepRoute';
import { StepTrain } from './steps/StepTrain';
import { StepSeats } from './steps/StepSeats';
import { StepPassengers } from './steps/StepPassengers';
import { StepReview } from './steps/StepReview';

export function NewJobForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (job: HuntJob) => void;
  onCancel: () => void;
}) {
  const form = useNewJobForm(onSubmit, onCancel);

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-blue-50/60 to-white">
      <header className="flex items-center justify-between px-4 pb-1 pt-4">
        <button
          type="button"
          onClick={form.goBack}
          aria-label={form.step === 0 ? 'Скасувати' : 'Назад'}
          className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
        >
          <BackIcon className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === form.step ? 'w-6 bg-blue-600' : 'w-2 bg-gray-300'
              }`}
            />
          ))}
        </div>
        <span className="w-8" />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-2">
        <div ref={form.panelRef} tabIndex={-1} className="outline-none">
          <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
            Крок {form.step + 1} з {STEPS.length}
          </span>
          <h2 className="mt-3 text-2xl font-bold leading-tight tracking-tight text-gray-900">
            {form.head.title}
          </h2>
          <p className="mt-1 mb-5 text-sm text-gray-500">{form.subtitle}</p>

          {form.step === 0 ? <StepRoute form={form} /> : null}
          {form.step === 1 ? <StepTrain form={form} /> : null}
          {form.step === 2 ? <StepSeats form={form} /> : null}
          {form.step === 3 ? <StepPassengers form={form} /> : null}
          {form.step === 4 ? <StepReview form={form} /> : null}
        </div>
      </div>

      <div className="space-y-2 border-t border-gray-100 bg-white/60 p-4">
        {form.errors.length > 0 ? (
          <ul
            ref={form.errorRef}
            role="alert"
            tabIndex={-1}
            className="space-y-1 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 outline-none"
          >
            {form.errors.map((e) => (
              <li key={e}>• {e}</li>
            ))}
          </ul>
        ) : null}

        {form.isLast ? (
          <Button variant="primary" size="lg" className="w-full" onClick={form.submit}>
            <PlayIcon className="h-5 w-5" /> Запустити пошук
          </Button>
        ) : (
          <Button variant="primary" size="lg" className="w-full" onClick={form.goNext}>
            Далі
          </Button>
        )}
      </div>
    </div>
  );
}
