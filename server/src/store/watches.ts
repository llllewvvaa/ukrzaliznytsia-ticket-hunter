import { randomUUID } from 'node:crypto';
import type { Db } from './db.js';

export interface SeatPrefs {
  berth?: 'lower' | 'upper';
  minSeats?: number;
  adjacent?: boolean;
  avoidToilet?: boolean;
  airConditioned?: boolean;
}

export interface Watch {
  id: string;
  chatId: number | null;
  name: string;
  fromId: number;
  toId: number;
  dateFrom: string;
  dateTo: string;
  classes: string[];
  seatPrefs: SeatPrefs;
  maxPriceKop: number | null;
  favorite: boolean;
  priority: number;
  state: 'active' | 'paused' | 'done';
  createdAt: number;
  updatedAt: number;
}

export interface WatchInput {
  chatId?: number | null;
  name?: string;
  fromId: number;
  toId: number;
  dateFrom: string;
  dateTo?: string;
  classes?: string[];
  seatPrefs?: SeatPrefs;
  maxPriceKop?: number | null;
  favorite?: boolean;
  priority?: number;
}

interface RawWatch {
  id: string;
  chatId: number | null;
  name: string | null;
  fromId: number;
  toId: number;
  dateFrom: string;
  dateTo: string;
  classes: string;
  seatPrefs: string;
  maxPriceKop: number | null;
  favorite: number;
  priority: number;
  state: string;
  createdAt: number;
  updatedAt: number;
}

const SELECT = `select id, chat_id as chatId, name, from_id as fromId, to_id as toId,
  date_from as dateFrom, date_to as dateTo, classes, seat_prefs as seatPrefs,
  max_price_kop as maxPriceKop, favorite, priority, state,
  created_at as createdAt, updated_at as updatedAt from watch`;

function hydrate(row: RawWatch): Watch {
  return {
    id: row.id,
    chatId: row.chatId,
    name: row.name ?? `${row.fromId} → ${row.toId}`,
    fromId: row.fromId,
    toId: row.toId,
    dateFrom: row.dateFrom,
    dateTo: row.dateTo,
    classes: JSON.parse(row.classes) as string[],
    seatPrefs: JSON.parse(row.seatPrefs) as SeatPrefs,
    maxPriceKop: row.maxPriceKop,
    favorite: row.favorite === 1,
    priority: row.priority,
    state: row.state as Watch['state'],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createWatch(db: Db, input: WatchInput, now: number): Watch {
  const id = randomUUID();
  db.prepare(
    `insert into watch (id, chat_id, name, from_id, to_id, date_from, date_to, classes, seat_prefs,
      max_price_kop, favorite, priority, state, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
  ).run(
    id,
    input.chatId ?? null,
    input.name ?? null,
    input.fromId,
    input.toId,
    input.dateFrom,
    input.dateTo ?? input.dateFrom,
    JSON.stringify(input.classes ?? []),
    JSON.stringify(input.seatPrefs ?? {}),
    input.maxPriceKop ?? null,
    input.favorite ? 1 : 0,
    input.priority ?? 0,
    now,
    now,
  );
  return getWatch(db, id)!;
}

export function getWatch(db: Db, id: string): Watch | undefined {
  const row = db.prepare(`${SELECT} where id = ?`).get(id) as unknown as RawWatch | undefined;
  return row ? hydrate(row) : undefined;
}

export function listWatches(db: Db, state?: Watch['state']): Watch[] {
  const rows = state
    ? (db.prepare(`${SELECT} where state = ? order by favorite desc, created_at`).all(state) as unknown as RawWatch[])
    : (db.prepare(`${SELECT} order by favorite desc, created_at`).all() as unknown as RawWatch[]);
  return rows.map(hydrate);
}

export function setWatchState(db: Db, id: string, state: Watch['state'], now: number): void {
  db.prepare('update watch set state = ?, updated_at = ? where id = ?').run(state, now, id);
}

export function setFavorite(db: Db, id: string, favorite: boolean, now: number): void {
  db.prepare('update watch set favorite = ?, updated_at = ? where id = ?').run(favorite ? 1 : 0, now, id);
}

export function deleteWatch(db: Db, id: string): void {
  db.prepare('delete from watch where id = ?').run(id);
}

export function watchDates(watch: Pick<Watch, 'dateFrom' | 'dateTo'>, maxDays = 30): string[] {
  const out: string[] = [];
  const start = new Date(`${watch.dateFrom}T00:00:00Z`);
  const end = new Date(`${watch.dateTo}T00:00:00Z`);
  for (let d = start; d <= end && out.length < maxDays; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}
