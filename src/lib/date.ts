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

// 'YYYY-MM-DDTHH:mm' in local time (the datetime-local shape).
export function localDateTimeIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
