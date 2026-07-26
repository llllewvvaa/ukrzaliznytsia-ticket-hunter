export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const DAY_MS = 86_400_000;

const pad = (n: number): string => String(n).padStart(2, '0');

// YYYY-MM-DD offset from today (UTC-sliced, matches UZ date params).
export function todayPlus(days: number): string {
  return new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10);
}

export const SALE_OPEN_DAYS_BEFORE = 20;
export const SALE_OPEN_HOUR = 8;

// Default UZ sale-open moment for a trip date: 20 days before, 08:00 local.
// Returns 'YYYY-MM-DDTHH:mm' (the datetime-local shape) or '' for bad input.
export function saleOpenDefault(tripIso: string): string {
  const match = DATE_RE.exec(tripIso);
  if (!match) return '';
  const [y, m, d] = tripIso.split('-').map(Number);
  // local Date constructor: month/year rollover and DST handled natively
  return localDateTimeIso(new Date(y!, m! - 1, d! - SALE_OPEN_DAYS_BEFORE, SALE_OPEN_HOUR, 0));
}

// 'YYYY-MM-DD' → 'DD.MM.YYYY'; passes non-ISO input through unchanged.
export function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

// 'YYYY-MM-DDTHH:mm' in local time (the datetime-local shape).
export function localDateTimeIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const DEFAULT_HOUR = 8;

export interface DateValue {
  y: number;
  m: number;
  d: number;
  hh: number;
  mm: number;
}

export const toIso = (y: number, m: number, d: number): string => `${y}-${pad(m + 1)}-${pad(d)}`;

// Parses 'YYYY-MM-DD' and 'YYYY-MM-DDTHH:mm'; time defaults to 08:00 when absent.
export function parseValue(s: string): DateValue | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(s);
  if (!match) return null;
  return {
    y: Number(match[1]),
    m: Number(match[2]) - 1,
    d: Number(match[3]),
    hh: match[4] !== undefined ? Number(match[4]) : DEFAULT_HOUR,
    mm: match[5] !== undefined ? Number(match[5]) : 0,
  };
}

export function formatValue(s: string, withTime: boolean): string {
  const p = parseValue(s);
  if (!p) return withTime ? 'Оберіть дату й час' : 'Оберіть дату';
  const date = `${pad(p.d)}.${pad(p.m + 1)}.${p.y}`;
  return withTime ? `${date}, ${pad(p.hh)}:${pad(p.mm)}` : date;
}

// Weekday of the 1st of the month, Monday = 0 (matches the WEEKDAYS header).
export function firstWeekday(y: number, m: number): number {
  return (new Date(y, m, 1).getDay() + 6) % 7;
}

// Leading nulls pad the grid so the 1st lands under its weekday column.
export function monthCells(y: number, m: number): Array<number | null> {
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  return [
    ...Array<null>(firstWeekday(y, m)).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
}

export function canPrevMonth(y: number, m: number, minDate: Date): boolean {
  return new Date(y, m, 1) > new Date(minDate.getFullYear(), minDate.getMonth(), 1);
}
