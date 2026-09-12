import type { Db } from './db.js';

export function setMeta(db: Db, key: string, value: string): void {
  db.prepare('insert or replace into meta (key, value) values (?, ?)').run(key, value);
}

export function getMeta(db: Db, key: string): string | null {
  const row = db.prepare('select value from meta where key = ?').get(key) as unknown as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function rememberChat(db: Db, chatId: number): void {
  setMeta(db, 'last_chat_id', String(chatId));
}

export function lastChat(db: Db): number | null {
  const raw = getMeta(db, 'last_chat_id');
  if (!raw) return null;
  const id = Number(raw);
  return Number.isFinite(id) ? id : null;
}
