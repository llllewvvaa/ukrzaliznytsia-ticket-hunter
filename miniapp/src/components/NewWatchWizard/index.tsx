import { useState } from 'react';
import { Button } from '../ui';
import { BackIcon } from '../icons';
import { api } from '../../lib/api';
import { useWizard } from './use-wizard';
import { StepDates } from './steps/StepDates';
import { StepReview } from './steps/StepReview';
import { StepRoute } from './steps/StepRoute';
import { StepSeats } from './steps/StepSeats';
import { STEP_HINT, STEP_TITLE, WIZARD_STEPS, type WizardState } from './types';

export function NewWatchWizard({
  initial,
  onDone,
  onCancel,
}: {
  initial?: Partial<WizardState>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const wizard = useWizard(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (): Promise<void> => {
    if (!wizard.state.from || !wizard.state.to) return;
    setBusy(true);
    setError('');
    try {
      await api.createWatch({
        fromId: wizard.state.from.id,
        toId: wizard.state.to.id,
        dateFrom: wizard.state.dateFrom,
        dateTo: wizard.dateTo,
        name: `${wizard.state.from.name} → ${wizard.state.to.name}`,
        classes: wizard.state.classes,
        maxPriceKop: wizard.state.maxPrice ? Math.round(Number(wizard.state.maxPrice) * 100) : null,
        favorite: wizard.state.favorite,
        alightEarlierMin: wizard.state.alightEarlierMin,
        seatPrefs: {
          ...(wizard.state.berth ? { berth: wizard.state.berth } : {}),
          ...(wizard.state.minSeats > 1 ? { minSeats: wizard.state.minSeats } : {}),
          ...(wizard.state.adjacent ? { adjacent: true } : {}),
        },
      });
      api.tap();
      onDone();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const handlePrimary = (): void => {
    if (wizard.isLast) {
      void submit();
      return;
    }
    wizard.next();
  };

  const handleBack = (): void => {
    if (wizard.index === 0) {
      onCancel();
      return;
    }
    wizard.back();
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleBack}
          aria-label="Назад"
          className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
        >
          <BackIcon className="h-4 w-4" />
        </button>
        <div className="flex flex-1 items-center justify-center gap-1.5">
          {WIZARD_STEPS.map((id, index) => (
            <span
              key={id}
              className={`h-1.5 rounded-full transition-all ${
                index === wizard.index ? 'w-6 bg-blue-600' : 'w-1.5 bg-gray-300'
              }`}
            />
          ))}
        </div>
        <span className="w-7" />
      </div>

      <h2 className="mt-4 text-lg font-bold text-gray-900">{STEP_TITLE[wizard.step]}</h2>
      <p className="mt-1 text-xs leading-relaxed text-gray-500">{STEP_HINT[wizard.step]}</p>

      <div className="mt-4">
        {wizard.step === 'route' ? <StepRoute state={wizard.state} patch={wizard.patch} /> : null}
        {wizard.step === 'dates' ? (
          <StepDates state={wizard.state} dateTo={wizard.dateTo} patch={wizard.patch} />
        ) : null}
        {wizard.step === 'seats' ? (
          <StepSeats state={wizard.state} patch={wizard.patch} toggleClass={wizard.toggleClass} />
        ) : null}
        {wizard.step === 'review' ? (
          <StepReview state={wizard.state} dateTo={wizard.dateTo} patch={wizard.patch} />
        ) : null}
      </div>

      {error ? <p className="mt-3 text-xs text-red-600">{error}</p> : null}

      <Button
        variant="primary"
        size="lg"
        className="mt-5 w-full"
        disabled={busy || !wizard.canGoNext}
        onClick={handlePrimary}
      >
        {wizard.isLast ? (busy ? 'Створюю…' : 'Створити стеження') : 'Далі'}
      </Button>
    </div>
  );
}
