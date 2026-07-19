import { useEffect, useRef, useState } from 'react';
import { createJobDraft, type JobFormInput } from '@/lib/job-factory';
import { shake, stepIn } from '@/lib/anim';
import { DATE_RE, saleOpenDefault, todayPlus } from '@/lib/date';
import type { CoachType, HuntJob, JobMode, Station } from '@/lib/models';
import type { SeatSelection } from '@/components/TrainPicker';
import { LAST_STEP, STEPS, type Step } from './constants';

export type Berth = 'any' | 'lower' | 'upper';

// Owns the whole reserve-wizard state machine: field values, step navigation,
// per-step validation and the final draft submit. Pure of DOM beyond the two
// animation refs it wires up.
export function useNewJobForm(onSubmit: (job: HuntJob) => void, onCancel: () => void) {
  const [name, setName] = useState('');
  const [showName, setShowName] = useState(false);
  const [from, setFrom] = useState<Station | null>(null);
  const [to, setTo] = useState<Station | null>(null);
  const [date, setDateRaw] = useState(todayPlus(30));
  const [trains, setTrains] = useState<string[]>([]);
  const [coachTypes, setCoachTypes] = useState<Array<CoachType | string>>([]);
  const [seatSelection, setSeatSelection] = useState<SeatSelection | null>(null);
  const [passengerIds, setPassengerIds] = useState<number[]>([]);
  const [bedding, setBedding] = useState(true);
  const [berth, setBerth] = useState<Berth>('any');
  const [adjacent, setAdjacent] = useState(false);
  const [avoidToilet, setAvoidToilet] = useState(false);
  const [airConditioned, setAirConditioned] = useState(false);
  const [mode, setMode] = useState<JobMode>('monitor');
  const [pollIntervalSec, setPollIntervalSec] = useState(15);
  const [startAt, setStartAtRaw] = useState('');
  const [maxAttempts, setMaxAttempts] = useState('5');

  // Sale-open time auto-fills from the trip date (20 days before, 08:00) until
  // the user edits it manually; a manual edit is never overwritten.
  const startAtTouched = useRef(false);
  const setStartAt = (v: string): void => {
    startAtTouched.current = true;
    setStartAtRaw(v);
  };
  const setDate = (iso: string): void => {
    setDateRaw(iso);
    if (!startAtTouched.current) setStartAtRaw(saleOpenDefault(iso));
  };

  const [errors, setErrors] = useState<string[]>([]);
  const [step, setStep] = useState<Step>(0);
  const [dir, setDir] = useState<'next' | 'back'>('next');
  const [swapSpin, setSwapSpin] = useState(false);
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

  const toggleCoach = (v: CoachType | string): void =>
    setCoachTypes((arr) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]));

  // Exact seats lock the job to one train + class.
  const handleSelectSeats = (sel: SeatSelection): void => {
    setSeatSelection(sel);
    setTrains([sel.match.trainNumber]);
    setCoachTypes([sel.match.classId]);
  };

  const swapStations = (): void => {
    setFrom(to);
    setTo(from);
    setSwapSpin((s) => !s);
  };

  // Mode swaps the train step (live search vs pre-sale timetable); drop stale picks.
  const selectType = (nextMode: JobMode): void => {
    setMode(nextMode);
    setTrains([]);
    setSeatSelection(null);
    if (nextMode === 'scheduled' && !startAtTouched.current) {
      setStartAtRaw(saleOpenDefault(date));
    }
  };

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

  const submit = (): void => {
    const input: JobFormInput = {
      name,
      from,
      to,
      date,
      preferredTrains: seatSelection ? [seatSelection.match.trainNumber] : trains,
      coachTypes: seatSelection ? [seatSelection.match.classId] : coachTypes,
      passengerIds,
      bedding,
      seatPrefs: seatSelection
        ? undefined
        : {
            ...(berth !== 'any' ? { berth } : {}),
            adjacent,
            avoidToilet,
            airConditioned,
          },
      manualSeats: seatSelection
        ? { wagonNumber: seatSelection.wagonNumber, seats: seatSelection.seats }
        : undefined,
      manualMatch: seatSelection ? seatSelection.match : undefined,
      mode,
      pollIntervalSec,
      startAt: startAt ? new Date(startAt).getTime() : undefined,
      // Scheduled sprints are bounded by the sprint window, not an attempt cap.
      maxAttempts: mode === 'scheduled' ? undefined : maxAttempts ? Number(maxAttempts) : undefined,
      nativeAvailable: false, // native endpoint TBD (discovery)
    };
    const { job, errors: errs } = createJobDraft(input);
    if (job) onSubmit(job);
    else failWith(errs);
  };

  const head = STEPS[step]!;
  const subtitle = ((): string => {
    if (step === 1 && mode === 'scheduled') {
      return 'Оберіть поїзд із розкладу — працює ще до відкриття продажу.';
    }
    if (step !== 4) return head.subtitle;
    return mode === 'scheduled'
      ? 'Вкажіть час відкриття продажу — о ньому почнеться спринт.'
      : 'Перевірте й запускайте.';
  })();

  return {
    // field values + setters
    name, setName,
    showName, setShowName,
    from, setFrom,
    to, setTo,
    date, setDate,
    trains, setTrains,
    coachTypes, toggleCoach,
    seatSelection, setSeatSelection,
    passengerIds, setPassengerIds,
    bedding, setBedding,
    berth, setBerth,
    adjacent, setAdjacent,
    avoidToilet, setAvoidToilet,
    airConditioned, setAirConditioned,
    mode, selectType,
    pollIntervalSec, setPollIntervalSec,
    startAt, setStartAt,
    maxAttempts, setMaxAttempts,
    // wizard chrome
    errors, step, swapSpin, head, subtitle,
    panelRef, errorRef,
    isLast: step === LAST_STEP,
    // actions
    handleSelectSeats,
    swapStations,
    goNext,
    goBack,
    submit,
  };
}

export type NewJobFormState = ReturnType<typeof useNewJobForm>;
