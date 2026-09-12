import type { Station } from '../../types';

export type WizardStep = 'route' | 'dates' | 'seats' | 'review';

export interface WizardState {
  from: Station | null;
  to: Station | null;
  dateFrom: string;
  days: number;
  classes: string[];
  maxPrice: string;
  berth: '' | 'lower' | 'upper';
  minSeats: number;
  adjacent: boolean;
  favorite: boolean;
  alightEarlierMin: number;
}

export const WIZARD_STEPS: WizardStep[] = ['route', 'dates', 'seats', 'review'];

export const STEP_TITLE: Record<WizardStep, string> = {
  route: 'Куди їдемо?',
  dates: 'Коли?',
  seats: 'Що вважати за влучання?',
  review: 'Перевірмо',
};

export const STEP_HINT: Record<WizardStep, string> = {
  route: 'Сторож перевірятиме не лише цю пару, а й сусідні станції та наскрізні сегменти.',
  dates: 'Можна взяти кілька днів поспіль і додати запас у сусідні дати.',
  seats: 'Ці правила вирішують, коли надсилати сповіщення.',
  review: 'Створимо стеження — далі воно працює саме.',
};
