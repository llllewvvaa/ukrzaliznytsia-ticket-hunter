import { useEffect, useRef, useState } from 'react';
import { shake, stepIn } from '@/lib/ui/anim';
import { DATE_RE } from '@/lib/format/date';
import type { Station } from '@/lib/models';
import { LAST_STEP, type Step } from './constants';

// Step navigation + per-step validation of the reserve wizard, including the
// panel/error animation effects wired to panelRef/errorRef.
export function useWizardNav({
  from,
  to,
  date,
  onCancel,
}: {
  from: Station | null;
  to: Station | null;
  date: string;
  onCancel: () => void;
}) {
  const [errors, setErrors] = useState<string[]>([]);
  const [step, setStep] = useState<Step>(0);
  const [dir, setDir] = useState<'next' | 'back'>('next');
  const [errorNonce, setErrorNonce] = useState(0);

  const panelRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLUListElement>(null);
  const firstStep = useRef(true);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    stepIn(panel, dir);
    // Move focus to the new step so keyboard/screen-reader users start from
    // its top — but not on first mount, where in-step autoFocus wins.
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    panel.focus({ preventScroll: true });
  }, [step]);

  useEffect(() => {
    if (errorNonce > 0 && errorRef.current) {
      shake(errorRef.current);
      errorRef.current.focus({ preventScroll: true });
    }
  }, [errorNonce]);

  const failWith = (issues: string[]): void => {
    setErrors(issues);
    setErrorNonce((n) => n + 1);
  };

  const validateStep0 = (): string[] => {
    const issues: string[] = [];
    if (!from) issues.push('Оберіть станцію відправлення.');
    if (!to) issues.push('Оберіть станцію призначення.');
    if (from && to && from.id === to.id) {
      issues.push('Станції відправлення та призначення мають відрізнятися.');
    }
    if (!DATE_RE.test(date)) issues.push('Вкажіть дату у форматі РРРР-ММ-ДД.');
    return issues;
  };

  const goNext = (): void => {
    if (step === 0) {
      const issues = validateStep0();
      if (issues.length) return failWith(issues);
    }
    setErrors([]);
    setDir('next');
    setStep((s) => (s < LAST_STEP ? ((s + 1) as Step) : s));
  };

  const goBack = (): void => {
    if (step === 0) return onCancel();
    setErrors([]);
    setDir('back');
    setStep((s) => (s > 0 ? ((s - 1) as Step) : s));
  };

  return {
    errors,
    step,
    panelRef,
    errorRef,
    isLast: step === LAST_STEP,
    failWith,
    goNext,
    goBack,
  };
}
