export const MIN_INTERVAL_MS = 120_000;
export const HOT_INTERVAL_MS = 120_000;
export const BASE_INTERVAL_MS = 300_000;
export const MAX_INTERVAL_MS = 1_800_000;
export const NIGHT_FACTOR = 4;
export const GROWTH = 1.6;

export interface IntervalOptions {
  min?: number;
  max?: number;
  growth?: number;
}

export function nextInterval(
  currentMs: number,
  changed: boolean,
  options: IntervalOptions = {},
): number {
  const min = options.min ?? MIN_INTERVAL_MS;
  const max = options.max ?? MAX_INTERVAL_MS;
  const growth = options.growth ?? GROWTH;
  if (changed) return min;
  return Math.min(max, Math.max(min, Math.round(currentMs * growth)));
}

export function isNight(now: number, tzOffsetHours = 3): boolean {
  const hour = new Date(now + tzOffsetHours * 3_600_000).getUTCHours();
  return hour >= 22 || hour < 7;
}

export function applyNight(intervalMs: number, now: number, tzOffsetHours = 3): number {
  return isNight(now, tzOffsetHours) ? intervalMs * NIGHT_FACTOR : intervalMs;
}

export function withJitter(intervalMs: number, random: number, spread = 0.2): number {
  const factor = 1 + (random * 2 - 1) * spread;
  return Math.max(1, Math.round(intervalMs * factor));
}

export function departureBoost(dateIso: string, now: number): number {
  const departure = new Date(`${dateIso}T00:00:00Z`).getTime();
  const hoursAway = (departure - now) / 3_600_000;
  if (hoursAway < 0) return 0;
  if (hoursAway <= 24) return 2;
  if (hoursAway <= 72) return 1.4;
  if (hoursAway >= 24 * 44 && hoursAway <= 24 * 46) return 1.8;
  return 1;
}
