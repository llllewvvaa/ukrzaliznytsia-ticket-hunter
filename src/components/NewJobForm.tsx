import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Button, Chip, Field, Input, Toggle } from '@/components/ui';
import { Select } from './Select';
import { createJobDraft, FORM_BOUNDS, type JobFormInput } from '@/lib/job-factory';
import type { CoachType, HuntJob, JobMode, Station } from '@/lib/models';
import { StationCombobox } from './StationCombobox';
import { TrainPicker, type SeatSelection } from './TrainPicker';
import { TimetablePicker } from './TimetablePicker';
import { PassengerPicker } from './PassengerPicker';
import { DatePicker } from './DatePicker';
import { NumberStepper } from './NumberStepper';
import { moveSegment, shake, stepIn } from '@/lib/anim';
import {
  AcIcon,
  AddIcon,
  BackIcon,
  BeddingIcon,
  HuntIcon,
  PlayIcon,
  ScheduleIcon,
  SwapIcon,
  ToiletIcon,
  TogetherIcon,
} from './icons';

const COACH_TYPES: Array<{ id: CoachType; name: string }> = [
  { id: 'Л', name: 'Люкс' },
  { id: 'К', name: 'Купе' },
  { id: 'П', name: 'Плацкарт' },
  { id: 'С1', name: 'Сидячий 1' },
  { id: 'С2', name: 'Сидячий 2' },
];

const QUICK_DATES: Array<{ days: number; label: string }> = [
  { days: 1, label: 'Завтра' },
  { days: 3, label: '+3 дні' },
  { days: 7, label: '+7 днів' },
  { days: 30, label: '+30 днів' },
];

const STEPS: Array<{ title: string; subtitle: string }> = [
  { title: 'Куди їдемо?', subtitle: 'Оберіть станції та дату поїздки.' },
  { title: 'Який поїзд?', subtitle: 'Звузьте вибір або лишіть «будь-який».' },
  { title: 'Які місця?', subtitle: 'Довірте вибір боту або оберіть вручну.' },
  { title: 'Хто їде?', subtitle: 'По одному пасажиру на кожне місце.' },
  { title: 'Майже готово', subtitle: 'Оберіть режим і запускайте.' },
];
const LAST = STEPS.length - 1;
type Step = 0 | 1 | 2 | 3 | 4;

function todayPlus(days: number): string {
  const d = new Date(Date.now() + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function NewJobForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (job: HuntJob) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [showName, setShowName] = useState(false);
  const [from, setFrom] = useState<Station | null>(null);
  const [to, setTo] = useState<Station | null>(null);
  const [date, setDate] = useState(todayPlus(30));
  const [trains, setTrains] = useState<string[]>([]);
  const [coachTypes, setCoachTypes] = useState<Array<CoachType | string>>([]);
  const [seatSelection, setSeatSelection] = useState<SeatSelection | null>(null);
  const [passengerIds, setPassengerIds] = useState<number[]>([]);
  const [bedding, setBedding] = useState(true);
  const [berth, setBerth] = useState<'any' | 'lower' | 'upper'>('any');
  const [adjacent, setAdjacent] = useState(false);
  const [avoidToilet, setAvoidToilet] = useState(false);
  const [airConditioned, setAirConditioned] = useState(false);
  const [mode, setMode] = useState<JobMode>('monitor');
  const [pollIntervalSec, setPollIntervalSec] = useState(15);
  const [startAt, setStartAt] = useState('');
  const [maxAttempts, setMaxAttempts] = useState('5');

  const [errors, setErrors] = useState<string[]>([]);

  const [step, setStep] = useState<Step>(0);
  const [dir, setDir] = useState<'next' | 'back'>('next');
  const [swapSpin, setSwapSpin] = useState(false);
  const [errorNonce, setErrorNonce] = useState(0);

  const panelRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (panelRef.current) stepIn(panelRef.current, dir);
  }, [step]);

  useEffect(() => {
    if (errorNonce > 0 && errorRef.current) shake(errorRef.current);
  }, [errorNonce]);

  const toggle = <T,>(arr: T[], v: T): T[] =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

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

  const failWith = (issues: string[]): void => {
    setErrors(issues);
    setErrorNonce((n) => n + 1);
  };

  const goNext = (): void => {
    if (step === 0) {
      const issues = validateStep0();
      if (issues.length) return failWith(issues);
    }
    setErrors([]);
    setDir('next');
    setStep((s) => (s < LAST ? ((s + 1) as Step) : s));
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

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-blue-50/60 to-white">
      <header className="flex items-center justify-between px-4 pb-1 pt-4">
        <button
          type="button"
          onClick={goBack}
          aria-label={step === 0 ? 'Скасувати' : 'Назад'}
          className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
        >
          <BackIcon className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === step ? 'w-6 bg-blue-600' : 'w-2 bg-gray-300'
              }`}
            />
          ))}
        </div>
        <span className="w-8" />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-2">
        <div ref={panelRef}>
          <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
            Крок {step + 1} з {STEPS.length}
          </span>
          <h2 className="mt-3 text-2xl font-bold leading-tight tracking-tight text-gray-900">
            {head.title}
          </h2>
          <p className="mt-1 mb-5 text-sm text-gray-500">{subtitle}</p>

          {step === 0 ? (
            <div className="space-y-4">
              <HuntTypeToggle mode={mode} onSelect={selectType} />
              <StationCombobox label="Звідки" value={from} onChange={setFrom} />
              <div className="-my-2 flex justify-center">
                <button
                  type="button"
                  onClick={swapStations}
                  aria-label="Поміняти напрямок місцями"
                  className="grid h-9 w-9 place-items-center rounded-full border border-gray-200 bg-white text-blue-600 shadow-sm transition-transform duration-300 hover:bg-blue-50"
                  style={{ transform: swapSpin ? 'rotate(180deg)' : 'rotate(0deg)' }}
                >
                  <SwapIcon className="h-4 w-4" />
                </button>
              </div>
              <StationCombobox label="Куди" value={to} onChange={setTo} />

              <Field label="Дата поїздки">
                <DatePicker value={date} onChange={setDate} min={todayPlus(0)} />
              </Field>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_DATES.map((q) => {
                  const v = todayPlus(q.days);
                  return (
                    <Chip key={q.days} active={date === v} onClick={() => setDate(v)}>
                      {q.label}
                    </Chip>
                  );
                })}
              </div>

              {showName ? (
                <Field label="Назва" hint="Необов'язково — згенерується автоматично">
                  <Input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="напр. Відпустка"
                  />
                </Field>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowName(true)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                >
                  <AddIcon className="h-4 w-4" /> Додати назву
                </button>
              )}
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-4">
              {mode === 'scheduled' ? (
                <Field
                  label="Поїзд із розкладу"
                  hint="Оберіть станції в розкладі УЗ (передзаповнено з маршруту) — список поїздів доступний ще до відкриття продажу"
                >
                  <TimetablePicker
                    seedFrom={from?.name}
                    seedTo={to?.name}
                    value={trains}
                    onChange={setTrains}
                  />
                </Field>
              ) : (
                <Field
                  label="Поїзди на цю дату"
                  hint="Оберіть зі списку, натисніть клас вагона щоб обрати місця, або лишіть порожнім = будь-який"
                >
                  <TrainPicker
                    from={from}
                    to={to}
                    date={date}
                    value={trains}
                    onChange={setTrains}
                    seatSelection={seatSelection}
                    onSelectSeats={handleSelectSeats}
                    onClearSeats={() => setSeatSelection(null)}
                  />
                </Field>
              )}

              {!seatSelection ? (
                <Field label="Типи вагонів" hint="Порожньо = будь-який; порядок задає пріоритет">
                  <div className="flex flex-wrap gap-2">
                    {COACH_TYPES.map((c) => (
                      <Chip
                        key={c.id}
                        active={coachTypes.includes(c.id)}
                        onClick={() => setCoachTypes(toggle(coachTypes, c.id))}
                      >
                        {c.id} · {c.name}
                      </Chip>
                    ))}
                  </div>
                </Field>
              ) : (
                <p className="rounded-2xl bg-blue-50 p-3 text-xs leading-relaxed text-blue-700">
                  Ви обрали конкретні місця (вагон {seatSelection.wagonNumber} ·{' '}
                  {seatSelection.seats.join(', ')}). Типи вагонів і преференції місць
                  ігноруються. Додайте стільки ж пасажирів, скільки місць (
                  {seatSelection.seats.length}) — по одному на кожне.
                </p>
              )}
            </div>
          ) : null}

          {step === 2 ? (
            seatSelection ? (
              <div className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-sm font-semibold text-blue-800">Конкретні місця обрано</p>
                <p className="text-xs leading-relaxed text-blue-700">
                  Вагон {seatSelection.wagonNumber} · місця {seatSelection.seats.join(', ')}.
                  Преференції нижче не застосовуються.
                </p>
                <Button size="sm" onClick={() => setSeatSelection(null)}>
                  Скинути й обрати преференції
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <Field
                  label="Полиця"
                  hint="Купе/плацкарт: непарні місця — нижні, парні — верхні"
                >
                  <Select
                    ariaLabel="Полиця"
                    value={berth}
                    options={[
                      { value: 'any', label: 'Будь-яка' },
                      { value: 'lower', label: 'Тільки нижні' },
                      { value: 'upper', label: 'Тільки верхні' },
                    ]}
                    onChange={(v) => setBerth(v as 'any' | 'lower' | 'upper')}
                  />
                </Field>
                <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
                  <Toggle
                    checked={airConditioned}
                    onChange={setAirConditioned}
                    label={iconLabel(<AcIcon className="h-4 w-4" />, 'З кондиціонером')}
                    hint="Тільки вагони з кондиціонером"
                  />
                  <Toggle
                    checked={avoidToilet}
                    onChange={setAvoidToilet}
                    label={iconLabel(<ToiletIcon className="h-4 w-4" />, 'Подалі від туалету')}
                    hint="Уникати крайніх купе; автовибір: спершу центр, потім початок, потім кінець"
                  />
                  <Toggle
                    checked={adjacent}
                    onChange={setAdjacent}
                    label={iconLabel(<TogetherIcon className="h-4 w-4" />, 'Місця поряд')}
                    hint="Для 2+ пасажирів — в одному купе"
                  />
                </div>
                <p className="rounded-2xl bg-blue-50 p-3 text-xs leading-relaxed text-blue-700">
                  Жорсткі умови: якщо вільних місць за цими критеріями немає, бронювання не
                  виконується — пошук триває далі.
                </p>
              </div>
            )
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <PassengerPicker value={passengerIds} onChange={setPassengerIds} />
              {seatSelection ? (
                <p
                  className={`rounded-2xl p-3 text-xs leading-relaxed ${
                    passengerIds.length === seatSelection.seats.length
                      ? 'bg-green-50 text-green-700'
                      : 'bg-amber-50 text-amber-800'
                  }`}
                >
                  Для обраних місць ({seatSelection.seats.join(', ')}) потрібно рівно{' '}
                  {seatSelection.seats.length} — по одному пасажиру на місце. Обрано{' '}
                  {passengerIds.length}.
                </p>
              ) : null}
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <Toggle
                  checked={bedding}
                  onChange={setBedding}
                  label={iconLabel(<BeddingIcon className="h-4 w-4" />, 'Постіль')}
                  hint="Для нічних поїздів"
                />
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="space-y-4">
              {mode === 'scheduled' ? (
                <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
                  <Field
                    label="Коли відкриваються продажі"
                    hint="За вашим годинником — о цьому часі почнеться суб-секундний спринт"
                  >
                    <Input
                      type="datetime-local"
                      value={startAt}
                      onChange={(e) => setStartAt(e.target.value)}
                    />
                  </Field>
                  <p className="flex items-start gap-2 rounded-2xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
                    <ScheduleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      Тримайте розширення відкритим до старту (найкраще — бічну панель, вона не
                      закривається), а комп'ютер — активним. Одразу після відкриття бот почне ловити
                      квитки з наявних вагонів.
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
                      value={pollIntervalSec}
                      onChange={setPollIntervalSec}
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
                      value={maxAttempts}
                      onChange={(e) => setMaxAttempts(e.target.value)}
                      placeholder="без обмеження"
                    />
                  </Field>
                </div>
              )}

              <dl className="space-y-2 rounded-2xl border border-gray-200 bg-white p-4 text-sm">
                <SummaryRow
                  label="Режим"
                  value={mode === 'scheduled' ? 'Заплановане до відкриття' : 'Моніторинг'}
                />
                <SummaryRow label="Маршрут" value={`${from?.name ?? '—'} → ${to?.name ?? '—'}`} />
                <SummaryRow label="Дата" value={date} />
                {mode === 'scheduled' ? (
                  <SummaryRow
                    label="Старт продажу"
                    value={startAt ? new Date(startAt).toLocaleString() : 'не вказано'}
                  />
                ) : null}
                <SummaryRow
                  label="Поїзди"
                  value={trains.length ? trains.join(', ') : 'будь-який'}
                />
                <SummaryRow
                  label="Місця"
                  value={
                    seatSelection
                      ? `вагон ${seatSelection.wagonNumber} · ${seatSelection.seats.join(', ')}`
                      : coachTypes.length
                        ? coachTypes.join(', ')
                        : 'будь-який вагон'
                  }
                />
                <SummaryRow label="Пасажири" value={String(passengerIds.length)} />
              </dl>
            </div>
          ) : null}
        </div>
      </div>

      <div className="space-y-2 border-t border-gray-100 bg-white/60 p-4">
        {errors.length > 0 ? (
          <ul
            ref={errorRef}
            className="space-y-1 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-700"
          >
            {errors.map((e) => (
              <li key={e}>• {e}</li>
            ))}
          </ul>
        ) : null}

        {step < LAST ? (
          <Button variant="primary" size="lg" className="w-full" onClick={goNext}>
            Далі
          </Button>
        ) : (
          <Button variant="primary" size="lg" className="w-full" onClick={submit}>
            <PlayIcon className="h-5 w-5" /> Запустити пошук
          </Button>
        )}
      </div>
    </div>
  );
}

function iconLabel(icon: ReactNode, text: string): ReactNode {
  return (
    <span className="inline-flex items-center gap-1.5">
      {icon}
      {text}
    </span>
  );
}

const HUNT_TYPES: { id: JobMode; title: string; desc: string; icon: ReactNode }[] = [
  { id: 'monitor', title: 'Стежити зараз', desc: 'Поїзд у продажу', icon: <HuntIcon className="h-4 w-4" /> },
  { id: 'scheduled', title: 'До відкриття', desc: 'Продажі ще ні', icon: <ScheduleIcon className="h-4 w-4" /> },
];

function HuntTypeToggle({ mode, onSelect }: { mode: JobMode; onSelect: (m: JobMode) => void }) {
  const indicatorRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Partial<Record<JobMode, HTMLButtonElement | null>>>({});
  const inited = useRef(false);

  useLayoutEffect(() => {
    const el = indicatorRef.current;
    const btn = btnRefs.current[mode];
    if (!el || !btn) return;
    moveSegment(el, btn, !inited.current);
    inited.current = true;
  }, [mode]);

  return (
    <div className="relative flex gap-2 rounded-2xl bg-gray-100 p-1">
      <div
        ref={indicatorRef}
        className="pointer-events-none absolute inset-y-1 left-0 w-0 rounded-xl bg-white shadow-sm ring-1 ring-blue-200"
        aria-hidden
      />
      {HUNT_TYPES.map((t) => {
        const active = mode === t.id;
        return (
          <button
            key={t.id}
            ref={(el) => {
              btnRefs.current[t.id] = el;
            }}
            type="button"
            onClick={() => onSelect(t.id)}
            className="relative z-10 flex flex-1 flex-col items-start gap-0.5 rounded-xl px-3 py-2 text-left transition-colors"
          >
            <span
              className={`inline-flex items-center gap-1.5 text-sm font-semibold transition-colors ${
                active ? 'text-blue-700' : 'text-gray-600'
              }`}
            >
              {t.icon}
              {t.title}
            </span>
            <span className="text-[11px] text-gray-400">{t.desc}</span>
          </button>
        );
      })}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-gray-500">{label}</dt>
      <dd className="text-right font-semibold text-gray-800">{value}</dd>
    </div>
  );
}
