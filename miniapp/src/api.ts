import type { Forecast, Offer, Station, Stats, Watch, WatchEvent } from './types.js';

interface TelegramWebApp {
  initData?: string;
  ready?: () => void;
  expand?: () => void;
  colorScheme?: string;
}

function webApp(): TelegramWebApp | undefined {
  return (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const initData = webApp()?.initData;
  if (initData) headers['x-telegram-init-data'] = initData;

  const response = await fetch(path, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`${response.status}: ${detail.slice(0, 200)}`);
  }
  return (await response.json()) as T;
}

export const api = {
  ready(): void {
    const app = webApp();
    app?.ready?.();
    app?.expand?.();
  },
  stations(query: string): Promise<{ stations: Station[] }> {
    return call(`/api/stations?q=${encodeURIComponent(query)}`);
  },
  ways(body: {
    fromId: number;
    toId: number;
    dates: string[];
    slack?: number;
    sort?: 'cheapest' | 'balanced';
    maxPriceKop?: number;
    classes?: string[];
  }): Promise<{ offers: Offer[]; requests: number; candidates: number; gated: boolean }> {
    return call('/api/ways', { method: 'POST', body: JSON.stringify(body) });
  },
  watches(): Promise<{ watches: Watch[] }> {
    return call('/api/watches');
  },
  createWatch(body: {
    fromId: number;
    toId: number;
    dateFrom: string;
    dateTo?: string;
    name?: string;
    classes?: string[];
    maxPriceKop?: number | null;
    favorite?: boolean;
    seatPrefs?: Record<string, unknown>;
  }): Promise<{ watch: Watch }> {
    return call('/api/watches', { method: 'POST', body: JSON.stringify(body) });
  },
  patchWatch(id: string, body: { favorite?: boolean; state?: 'active' | 'paused' }): Promise<{ watch: Watch }> {
    return call(`/api/watches/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  },
  deleteWatch(id: string): Promise<{ deleted: string }> {
    return call(`/api/watches/${id}`, { method: 'DELETE' });
  },
  events(id: string): Promise<{ events: WatchEvent[] }> {
    return call(`/api/watches/${id}/events`);
  },
  stats(): Promise<Stats> {
    return call('/api/stats');
  },
  forecast(train: string, classId: string): Promise<{ forecast: Forecast }> {
    return call(`/api/forecast?train=${encodeURIComponent(train)}&class=${encodeURIComponent(classId)}`);
  },
};

export function hryvnia(kop: number): string {
  return `${(kop / 100).toFixed(2)} грн`;
}

export function kyivTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString('uk-UA', {
    timeZone: 'Europe/Kyiv',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function isoDate(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}
