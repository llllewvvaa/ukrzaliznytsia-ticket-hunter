import type { HuntJob } from '@/lib/models';
import { STEPS } from './constants';
import { useFormFields } from './use-form-fields';
import { useWizardNav } from './use-wizard-nav';
import { useSubmitJob } from './use-submit-job';

// Owns the whole reserve-wizard state machine: field values, step navigation,
// per-step validation and the final draft submit. Composes useFormFields,
// useWizardNav and useSubmitJob; pure of DOM beyond their animation refs.
export function useNewJobForm(onSubmit: (job: HuntJob) => void, onCancel: () => void) {
  const fields = useFormFields();
  const wizard = useWizardNav({
    from: fields.from,
    to: fields.to,
    date: fields.date,
    onCancel,
  });
  const submit = useSubmitJob(fields, wizard.failWith, onSubmit);

  const head = STEPS[wizard.step]!;
  const subtitle = ((): string => {
    if (wizard.step === 1 && fields.mode === 'scheduled') {
      return 'Оберіть поїзд із розкладу — працює ще до відкриття продажу.';
    }
    if (wizard.step !== 4) return head.subtitle;
    return fields.mode === 'scheduled'
      ? 'Вкажіть час відкриття продажу — о ньому почнеться спринт.'
      : 'Перевірте й запускайте.';
  })();

  return {
    ...fields,
    errors: wizard.errors,
    step: wizard.step,
    head,
    subtitle,
    panelRef: wizard.panelRef,
    errorRef: wizard.errorRef,
    isLast: wizard.isLast,
    goNext: wizard.goNext,
    goBack: wizard.goBack,
    submit,
  };
}
