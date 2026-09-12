import type { Forecast, Offer, Station, Stats, Watch, WatchEvent, WatchOptions } from '../types';

interface TelegramWebApp {
  initData?: string;
  ready?: () => void;
  expand?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  HapticFeedback?: { impactOccurred?: (style: string) => void };
}

function webApp(): TelegramWebApp | undefined {
  return (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
}

export class LockedError extends Error {
  constructor() {
    super('locked');
    this.name = 'LockedError';
  }
}

export function hasTelegram(): boolean {
  return Boolean(webApp()?.initData);
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  const initData = webApp()?.initData;
  if (initData) headers['x-telegram-init-data'] = initData;

  const response = await fetch(path, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  if (response.status === 401 || response.status === 429) throw new LockedError();
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`${response.status}: ${detail.slice(0, 160)}`);
  }
  return (await response.json()) as T;
}

export interface WaysRequest {
  fromId: number;
  toId: number;
  dates: string[];
  slack?: number;
  sort?: 'cheapest' | 'balanced';
  classes?: string[];
  maxPriceKop?: number;
}

export interface WatchRequest {
  fromId: number;
  toId: number;
  dateFrom: string;
  dateTo?: string;
  name?: string;
  classes?: string[];
  maxPriceKop?: number | null;
  favorite?: boolean;
  seatPrefs?: Record<string, unknown>;
  alightEarlierMin?: number;
}

export const api = {
  ready(): void {
    const app = webApp();
    app?.ready?.();
    app?.expand?.();
    app?.setHeaderColor?.('#eef2ff');
    app?.setBackgroundColor?.('#eef2ff');
  },
  tap(): void {
    webApp()?.HapticFeedback?.impactOccurred?.('light');
  },
  stations(query: string): Promise<{ stations: Station[] }> {
    return call(`/api/stations?q=${encodeURIComponent(query)}`);
  },
  ways(
    body: WaysRequest,
  ): Promise<{ offers: Offer[]; requests: number; candidates: number; gated: boolean }> {
    return call('/api/ways', { method: 'POST', body: JSON.stringify(body) });
  },
  watches(): Promise<{ watches: Watch[] }> {
    return call('/api/watches');
  },
  createWatch(body: WatchRequest): Promise<{ watch: Watch }> {
    return call('/api/watches', { method: 'POST', body: JSON.stringify(body) });
  },
  patchWatch(
    id: string,
    body: { favorite?: boolean; state?: 'active' | 'paused'; alightEarlierMin?: number },
  ): Promise<{ watch: Watch }> {
    return call(`/api/watches/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
  },
  deleteWatch(id: string): Promise<{ deleted: string }> {
    return call(`/api/watches/${id}`, { method: 'DELETE' });
  },
  options(id: string, markViewed: boolean): Promise<WatchOptions> {
    return call(`/api/watches/${id}/options${markViewed ? '?markViewed=1' : ''}`);
  },
  events(id: string): Promise<{ events: WatchEvent[] }> {
    return call(`/api/watches/${id}/events`);
  },
  stats(): Promise<Stats> {
    return call('/api/stats');
  },
  forecast(train: string, classId: string): Promise<{ forecast: Forecast }> {
    return call(
      `/api/forecast?train=${encodeURIComponent(train)}&class=${encodeURIComponent(classId)}`,
    );
  },
};
