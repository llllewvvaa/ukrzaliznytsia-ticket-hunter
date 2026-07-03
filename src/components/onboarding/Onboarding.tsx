import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui';
import { BackIcon, ExternalIcon, ForwardIcon, TicketIcon } from '@/components/icons';
import { onboardingReveal, onboardingStep } from '@/lib/anim';
import { closeOnboardingTab, markOnboardingSeen, openBookingFromOnboarding } from '@/lib/onboarding';
import { PopupFrame } from './PopupFrame';
import {
  DoneScreen,
  HuntsScreen,
  PassengersScreen,
  ReserveScreen,
  RouteScreen,
  SeatsScreen,
  SettingsScreen,
} from './mockScreens';

interface Step {
  tab: 'hunts' | 'orders' | 'settings';
  authOk?: boolean;
  eyebrow: string;
  title: string;
  body: string;
  pills: string[];
  screen: ReactNode;
}

const STEPS: Step[] = [
  {
    tab: 'hunts',
    eyebrow: 'Огляд',
    title: 'Ваш мисливець за квитками',
    body: 'UZ Ticket Hunter сам стежить за квитками на booking.uz і бронює місце, щойно воно звільниться. Оплату ви завершуєте вручну — у межах ~15-хвилинного утримання.',
    pills: ['Моніторинг', 'Автобронювання', 'Оплата вручну'],
    screen: <HuntsScreen />,
  },
  {
    tab: 'hunts',
    eyebrow: 'Крок 1 · Вхід',
    title: 'Увійдіть на booking.uz',
    body: 'Залогіньтесь у booking.uz у цьому браузері — розширення підхопить вашу сесію автоматично. Зелена позначка «Сесія активна» вгорі означає, що все готово.',
    pills: ['Ваша сесія', 'Автоматично', 'Паролі лишаються у вас'],
    screen: <HuntsScreen />,
  },
  {
    tab: 'hunts',
    eyebrow: 'Крок 2 · Маршрут',
    title: 'Створіть пошук',
    body: 'Вкажіть станції та дату. За бажанням звузьте до конкретних поїздів і типів вагонів — або лишіть «будь-який», і бот перевірятиме всі.',
    pills: ['Маршрут', 'Дата', 'Поїзди'],
    screen: <RouteScreen />,
  },
  {
    tab: 'hunts',
    eyebrow: 'Крок 3 · Місця',
    title: 'Місця — авто або вручну',
    body: 'Довірте вибір боту за вподобаннями (полиця, кондиціонер, подалі від туалету) — тоді він бере місця ближче до центру вагона, далі до початку й лише потім до кінця. Або оберіть конкретні місця на схемі.',
    pills: ['Полиця', 'Подалі від туалету', 'Ручний вибір'],
    screen: <SeatsScreen />,
  },
  {
    tab: 'hunts',
    eyebrow: 'Крок 4 · Пасажири',
    title: 'Пасажири та режим',
    body: 'Оберіть пасажирів — по одному на кожне місце. «Моніторинг» стежить постійно, «Запланований» стартує за секунди до відкриття продажу квитків.',
    pills: ['Пасажири', 'Моніторинг', 'Запланований'],
    screen: <PassengersScreen />,
  },
  {
    tab: 'hunts',
    eyebrow: 'Крок 5 · Резерв',
    title: 'Бронювання і кошик',
    body: 'Щойно місце знайдено, бот його бронює й відкриває кошик. У вас ~15 хвилин на оплату. reCAPTCHA завжди проходите ви — бот її не обходить.',
    pills: ['~15 хвилин', 'Кошик', 'reCAPTCHA — вручну'],
    screen: <ReserveScreen />,
  },
  {
    tab: 'settings',
    eyebrow: 'Зручність',
    title: 'Бічна панель і налаштування',
    body: 'Винесіть розширення в бічну панель, щоб воно було відкрите поряд із booking.uz і не закривалося. Там само — режим дебагу для діагностики.',
    pills: ['Бічна панель', 'Дебаг', 'Синхронізація'],
    screen: <SettingsScreen />,
  },
  {
    tab: 'hunts',
    eyebrow: 'Готово',
    title: 'Вперед — створіть перший пошук',
    body: 'Відкрийте booking.uz і увійдіть — розширення підхопить вашу сесію, і можна створювати перший пошук. Цей гайд завжди можна відкрити знову з «Налаштувань».',
    pills: ['Лише особисте використання', 'Чесна гра'],
    screen: <DoneScreen />,
  },
];

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
      if (e.key === 'ArrowRight') last ? finish() : go(i + 1);
      else if (e.key === 'ArrowLeft') go(i - 1);
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
                <div ref={screenRef}>{step.screen}</div>
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
              <Button variant="secondary" onClick={() => go(i - 1)} disabled={i === 0}>
                <BackIcon className="h-4 w-4" /> Назад
              </Button>
              {last ? (
                <Button variant="primary" onClick={goToBooking}>
                  <ExternalIcon className="h-4 w-4" /> Відкрити booking.uz
                </Button>
              ) : (
                <Button variant="primary" onClick={() => go(i + 1)}>
                  Далі <ForwardIcon className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="mt-8 flex items-center gap-2">
              {STEPS.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => go(idx)}
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
