import type { CoachType } from '@/lib/models';

export const COACH_TYPES: Array<{ id: CoachType; name: string }> = [
  { id: 'Л', name: 'Люкс' },
  { id: 'К', name: 'Купе' },
  { id: 'П', name: 'Плацкарт' },
  { id: 'С1', name: 'Сидячий 1' },
  { id: 'С2', name: 'Сидячий 2' },
];

export const QUICK_DATES: Array<{ days: number; label: string }> = [
  { days: 1, label: 'Завтра' },
  { days: 3, label: '+3 дні' },
  { days: 7, label: '+7 днів' },
  { days: 30, label: '+30 днів' },
];

export const STEPS: Array<{ title: string; subtitle: string }> = [
  { title: 'Куди їдемо?', subtitle: 'Оберіть станції та дату поїздки.' },
  { title: 'Який поїзд?', subtitle: 'Звузьте вибір або лишіть «будь-який».' },
  { title: 'Які місця?', subtitle: 'Довірте вибір боту або оберіть вручну.' },
  { title: 'Хто їде?', subtitle: 'По одному пасажиру на кожне місце.' },
  { title: 'Майже готово', subtitle: 'Оберіть режим і запускайте.' },
];

export const LAST_STEP = STEPS.length - 1;

export type Step = 0 | 1 | 2 | 3 | 4;
