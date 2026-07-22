import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui';
import { BackIcon, ExternalIcon, ForwardIcon, TicketIcon } from '@/components/icons';
import { onboardingReveal, onboardingStep } from '@/lib/ui/anim';
import {
  closeOnboardingTab,
  markOnboardingSeen,
  openBookingFromOnboarding,
} from '@/lib/ui/onboarding';
import { PopupFrame } from './PopupFrame';
import { STEPS } from './constants';

export function Onboarding() {
  const [i, setI] = useState(0);
  const mockRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);
  const colRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  const step = STEPS[i]!;
  const last = i === STEPS.length - 1;

  const go = (n: number): void => setI(Math.min(STEPS.length - 1, Math.max(0, n)));
  const finish = (): void => void markOnboardingSeen().then(closeOnboardingTab);
  const goToBooking = (): void => void openBookingFromOnboarding();
  const goPrev = (): void => go(i - 1);
  const goNext = (): void => go(i + 1);
  const goToStep = (idx: number) => (): void => go(idx);

  // Mark seen on mount so the install auto-open fires only once.
  useEffect(() => {
    void markOnboardingSeen();
  }, []);

  useLayoutEffect(() => {
    // First paint animates the whole frame + copy column; later steps animate only the changed copy + screen.
    if (first.current) {
      first.current = false;
      if (mockRef.current && colRef.current) {
        onboardingReveal(mockRef.current, Array.from(colRef.current.children));
      }
      return;
    }
    onboardingStep([copyRef.current, screenRef.current].filter(Boolean) as Element[]);
  }, [i]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'ArrowRight') {
        if (last) finish();
        else go(i + 1);
      } else if (e.key === 'ArrowLeft') go(i - 1);
      else if (e.key === 'Escape') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [i, last]);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50 text-gray-900">
      <div className="pointer-events-none absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-blue-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-indigo-200/40 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
            <TicketIcon className="h-5 w-5 text-blue-600" /> UZ Ticket Hunter
          </div>
          <button
            type="button"
            onClick={finish}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
          >
            Пропустити
          </button>
        </div>

        <div className="grid flex-1 items-center gap-10 py-8 lg:grid-cols-2">
          <div className="flex justify-center lg:justify-end">
            <div ref={mockRef} className="relative">
              <PopupFrame activeTab={step.tab} authOk={step.authOk ?? true}>
                {/* Demo screens render real but dead controls (noop handlers);
                    inert keeps them out of the tab order and a11y tree. */}
                <div ref={screenRef} inert>
                  {step.screen}
                </div>
              </PopupFrame>
            </div>
          </div>

          <div ref={colRef} className="mx-auto w-full max-w-md">
            <div ref={copyRef}>
              <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                {step.eyebrow}
              </span>
              <h2 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-gray-900">
                {step.title}
              </h2>
              <p className="mt-3 text-base leading-relaxed text-gray-600">{step.body}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {step.pills.map((p) => (
                  <span
                    key={p}
                    className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-8 flex items-center gap-3">
              <Button variant="secondary" onClick={goPrev} disabled={i === 0}>
                <BackIcon className="h-4 w-4" /> Назад
              </Button>
              {last ? (
                <Button variant="primary" onClick={goToBooking}>
                  <ExternalIcon className="h-4 w-4" /> Відкрити booking.uz
                </Button>
              ) : (
                <Button variant="primary" onClick={goNext}>
                  Далі <ForwardIcon className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="mt-8 flex items-center gap-2">
              {STEPS.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={goToStep(idx)}
                  aria-label={`Крок ${idx + 1}`}
                  className={`h-2 rounded-full transition-all ${
                    idx === i ? 'w-6 bg-blue-600' : 'w-2 bg-gray-300 hover:bg-gray-400'
                  }`}
                />
              ))}
              <span className="ml-2 text-xs font-medium text-gray-400">
                {i + 1} / {STEPS.length}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
