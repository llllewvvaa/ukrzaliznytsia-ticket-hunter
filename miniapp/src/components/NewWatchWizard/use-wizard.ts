import { useMemo, useState } from 'react';
import { isoDate, shiftIso } from '../../lib/format';
import { WIZARD_STEPS, type WizardState, type WizardStep } from './types';

export function useWizard(initial?: Partial<WizardState>) {
  const [step, setStep] = useState<WizardStep>('route');
  const [state, setState] = useState<WizardState>({
    from: null,
    to: null,
    dateFrom: isoDate(7),
    days: 1,
    classes: [],
    maxPrice: '',
    berth: '',
    minSeats: 1,
    adjacent: false,
    favorite: true,
    alightEarlierMin: 30,
    ...initial,
  });

  const patch = (next: Partial<WizardState>): void =>
    setState((current) => ({ ...current, ...next }));

  const dateTo = useMemo(
    () => shiftIso(state.dateFrom, state.days - 1),
    [state.dateFrom, state.days],
  );

  const index = WIZARD_STEPS.indexOf(step);
  const canGoNext =
    step === 'route'
      ? state.from != null && state.to != null && state.from.id !== state.to.id
      : true;

  const next = (): void => {
    const target = WIZARD_STEPS[Math.min(index + 1, WIZARD_STEPS.length - 1)]!;
    setStep(target);
  };

  const back = (): void => {
    const target = WIZARD_STEPS[Math.max(index - 1, 0)]!;
    setStep(target);
  };

  const toggleClass = (id: string): void =>
    patch({
      classes: state.classes.includes(id)
        ? state.classes.filter((value) => value !== id)
        : [...state.classes, id],
    });

  return {
    step,
    index,
    state,
    patch,
    dateTo,
    canGoNext,
    next,
    back,
    toggleClass,
    isLast: step === 'review',
  };
}
