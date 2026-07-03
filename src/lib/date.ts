export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const DAY_MS = 86_400_000;

// YYYY-MM-DD offset from today (UTC-sliced, matches UZ date params).
export function todayPlus(days: number): string {
  return new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10);
}
