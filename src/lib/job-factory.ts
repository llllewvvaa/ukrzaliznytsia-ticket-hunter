import { newJobId } from './store';
import { DATE_RE } from './date';
import {
  MONITOR_MIN_MS,
  MONITOR_MAX_MS,
  SPRINT_MIN_MS,
  SPRINT_MAX_MS,
  clampMonitorInterval,
  clampSprintInterval,
} from './scheduler';
import type { CoachType, HuntJob, JobMode, MatchRef, SeatPrefs, Station } from './models';

export interface JobFormInput {
  name?: string;
  from: Station | null;
  to: Station | null;
  date: string; // YYYY-MM-DD
  preferredTrains: string[];
  coachTypes: Array<CoachType | string>;
  passengerIds: number[];
  bedding: boolean;
  seatPrefs?: SeatPrefs;
  manualSeats?: { wagonNumber: string; seats: number[] };
  manualMatch?: MatchRef;
  mode: JobMode;
  pollIntervalSec?: number;
  startAt?: number; // ms epoch
  sprintIntervalMs?: number;
  maxAttempts?: number;
  nativeAvailable?: boolean;
}

export interface JobDraftResult {
  job?: HuntJob;
  errors: string[];
}

export function createJobDraft(
  input: JobFormInput,
  now: number = Date.now(),
): JobDraftResult {
  const errors: string[] = [];

  if (!input.from) errors.push('Оберіть станцію відправлення.');
  if (!input.to) errors.push('Оберіть станцію призначення.');
  if (input.from && input.to && input.from.id === input.to.id) {
    errors.push('Станції відправлення та призначення мають відрізнятися.');
  }
  if (!DATE_RE.test(input.date)) errors.push('Вкажіть дату у форматі РРРР-ММ-ДД.');
  if (input.passengerIds.length === 0) errors.push('Додайте щонайменше одного пасажира.');

  if (input.mode === 'scheduled') {
    if (input.startAt == null) errors.push('Вкажіть час старту для запланованого режиму.');
    else if (input.startAt <= now) errors.push('Час старту має бути в майбутньому.');
  }
  if (input.mode === 'native' && input.nativeAvailable === false) {
    errors.push('Нативний моніторинг недоступний (не підтверджено на discovery).');
  }
  if (input.maxAttempts != null && input.maxAttempts < 1) {
    errors.push('Максимум спроб має бути ≥ 1.');
  }
  if (input.manualSeats) {
    const picked = new Set(input.manualSeats.seats).size;
    if (picked === 0) errors.push('Оберіть місця на схемі вагона.');
    else if (picked !== input.passengerIds.length) {
      errors.push(
        `Кількість обраних місць (${picked}) має дорівнювати кількості пасажирів (${input.passengerIds.length}).`,
      );
    }
  }

  if (errors.length > 0 || !input.from || !input.to) return { errors };

  const name =
    input.name?.trim() || `${input.from.name} → ${input.to.name} (${input.date})`;

  const job: HuntJob = {
    id: newJobId(),
    name,
    state: 'idle',
    mode: input.mode,
    from: input.from,
    to: input.to,
    date: input.date,
    preferredTrains: dedupe(input.preferredTrains),
    coachTypes: dedupe(input.coachTypes),
    passengerIds: dedupe(input.passengerIds),
    bedding: input.bedding,
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  };

  if (input.mode === 'monitor') {
    job.pollIntervalMs = clampMonitorInterval(
      input.pollIntervalSec != null ? input.pollIntervalSec * 1_000 : undefined,
    );
  }
  if (input.mode === 'scheduled') {
    job.startAt = input.startAt;
    job.sprintIntervalMs = clampSprintInterval(input.sprintIntervalMs);
  }
  if (input.maxAttempts != null) job.maxAttempts = input.maxAttempts;

  if (input.manualSeats && input.manualSeats.seats.length > 0) {
    job.manualSeats = {
      wagonNumber: input.manualSeats.wagonNumber,
      seats: dedupe(input.manualSeats.seats),
    };
    if (input.manualMatch) job.lastMatch = input.manualMatch;
  } else {
    const seatPrefs = normalizeSeatPrefs(input.seatPrefs);
    if (seatPrefs) job.seatPrefs = seatPrefs;
  }

  return { job, errors: [] };
}

function normalizeSeatPrefs(prefs?: SeatPrefs): SeatPrefs | undefined {
  if (!prefs) return undefined;
  const out: SeatPrefs = {};
  if (prefs.berth) out.berth = prefs.berth;
  if (prefs.adjacent) out.adjacent = true;
  if (prefs.avoidToilet) out.avoidToilet = true;
  if (prefs.airConditioned) out.airConditioned = true;
  return Object.keys(out).length > 0 ? out : undefined;
}

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

export const FORM_BOUNDS = {
  monitorMinSec: MONITOR_MIN_MS / 1000,
  monitorMaxSec: MONITOR_MAX_MS / 1000,
  sprintMinMs: SPRINT_MIN_MS,
  sprintMaxMs: SPRINT_MAX_MS,
};
