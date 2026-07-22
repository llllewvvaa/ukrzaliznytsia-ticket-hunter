import type { HuntJob, JobMode, JobState, PauseReason } from '@/lib/models';

export const BOOKING_URL = 'https://booking.uz.gov.ua/';

export function stateTone(state: JobState): string {
  switch (state) {
    case 'hunting':
      return 'bg-blue-100 text-blue-700';
    case 'scheduled':
      return 'bg-indigo-100 text-indigo-700';
    case 'reserving':
      return 'bg-amber-100 text-amber-800';
    case 'reserved':
      return 'bg-green-100 text-green-700';
    case 'paused':
      return 'bg-yellow-100 text-yellow-800';
    case 'failed':
      return 'bg-red-100 text-red-700';
    case 'cancelled':
      return 'bg-gray-200 text-gray-600';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

const STATE_LABELS: Record<JobState, string> = {
  idle: 'Очікує',
  scheduled: 'Заплановано',
  hunting: 'Пошук',
  reserving: 'Резервування',
  paused: 'Пауза',
  reserved: 'Зарезервовано',
  failed: 'Помилка',
  cancelled: 'Скасовано',
};

const PAUSE_LABELS: Record<PauseReason, string> = {
  user: 'вручну',
  not_authenticated: 'немає сесії',
  captcha: 'reCAPTCHA',
  rate_limited: 'ліміт запитів',
};

export function stateLabel(job: Pick<HuntJob, 'state' | 'pauseReason'>): string {
  const base = STATE_LABELS[job.state] ?? job.state;
  if (job.state === 'paused' && job.pauseReason) {
    return `${base} · ${PAUSE_LABELS[job.pauseReason] ?? job.pauseReason}`;
  }
  return base;
}

export function modeLabel(mode: JobMode): string {
  switch (mode) {
    case 'monitor':
      return 'Моніторинг';
    case 'scheduled':
      return 'Запланований';
    case 'native':
      return 'Нативний';
  }
}

export function relTime(ts: number | undefined, now: number = Date.now()): string {
  if (!ts) return '—';
  const diff = Math.max(0, now - ts);
  const seconds = Math.round(diff / 1000);
  if (seconds < 60) return `${seconds} с тому`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} хв тому`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} год тому`;
  return new Date(ts).toLocaleString();
}

export function clockTime(ts: number | undefined): string {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function holdUntilLabel(
  reservedUntil: number | undefined,
  now: number = Date.now(),
): string {
  if (!reservedUntil || reservedUntil <= now) return '';
  return `Заброньовано на ${clockTime(reservedUntil)}`;
}

export function holdExpired(reservedUntil: number | undefined, now: number = Date.now()): boolean {
  return reservedUntil != null && reservedUntil <= now;
}

export function scheduledLabel(startAt: number | undefined): string {
  if (!startAt) return '';
  const d = new Date(startAt);
  const date = d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const time = d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
  return `${date} о ${time}`;
}

export function friendlyError(raw: string | undefined): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  // UZ errors are stored as raw `{"message":…,"error_code":N}` JSON — surface the message.
  if (trimmed.startsWith('{') && trimmed.includes('"message"')) {
    try {
      const data = JSON.parse(trimmed) as { message?: unknown };
      if (typeof data.message === 'string' && data.message.trim()) return data.message;
    } catch {
      // not a JSON error payload — fall through to the raw message
    }
  }
  return raw;
}

export const ACTIVE_UI_STATES: readonly JobState[] = ['scheduled', 'hunting', 'reserving'];

export function isActive(state: JobState): boolean {
  return ACTIVE_UI_STATES.includes(state);
}

export function canStart(state: JobState): boolean {
  return state === 'idle' || state === 'failed' || state === 'cancelled';
}

// Ukrainian plural of «пошук»: 1 пошук, 2–4 пошуки, 5+ пошуків (11–14 always «пошуків»).
export function pluralHunts(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'пошук';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'пошуки';
  return 'пошуків';
}

export function controlConfirmCopy(
  action: 'delete' | 'cancel',
  name: string,
): { title: string; message: string; confirmLabel: string; cancelLabel: string } {
  if (action === 'delete') {
    return {
      title: 'Видалити пошук?',
      message: `«${name}» буде видалено назавжди.`,
      confirmLabel: 'Видалити',
      cancelLabel: 'Скасувати',
    };
  }
  return {
    title: 'Скасувати пошук?',
    message: `«${name}» зупиниться й перейде в неактивні.`,
    confirmLabel: 'Так, скасувати',
    cancelLabel: 'Ні',
  };
}
