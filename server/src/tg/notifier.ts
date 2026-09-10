import type { Db } from '../store/db.js';
import { markNotified, pendingEvents, type StoredEvent } from '../store/history.js';
import { getWatch } from '../store/watches.js';
import { lastChat } from '../store/meta.js';
import { describeEvent } from '../service/format.js';
import { digestText, eventKey, mayTellNow, selectForDigest, type DigestGate } from './digest.js';
import { getMeta, setMeta } from '../store/meta.js';

export type SendFn = (chatId: number, text: string) => Promise<void>;

export interface FlushResult {
  sent: number;
  skipped: number;
  stale: number;
  messages: number;
  held: number;
}

export const STALE_EVENT_MS = 30 * 60_000;

export function eventText(db: Db, event: StoredEvent): string {
  const watch = getWatch(db, event.watchId);
  const head = watch ? `[${watch.name}]` : '[стеження]';
  return `${head}\n${describeEvent(event)}`;
}

export function readDigestGate(db: Db, watchId: string): DigestGate {
  const raw = getMeta(db, `digest:${watchId}`);
  if (!raw) return { lastSentAt: null, lastBestPriceKop: null };
  try {
    return JSON.parse(raw) as DigestGate;
  } catch {
    return { lastSentAt: null, lastBestPriceKop: null };
  }
}

export function writeDigestGate(db: Db, watchId: string, gate: DigestGate): void {
  setMeta(db, `digest:${watchId}`, JSON.stringify(gate));
}

export function lastToldMap(db: Db, watchId: string): Map<string, number> {
  const rows = db
    .prepare(
      `select kind, payload_json as payload, notified_at as notifiedAt
       from event where watch_id = ? and notified_at is not null order by notified_at desc limit 400`,
    )
    .all(watchId) as unknown as { kind: string; payload: string; notifiedAt: number }[];

  const out = new Map<string, number>();
  for (const row of rows) {
    const event: StoredEvent = {
      id: 0,
      watchId,
      kind: row.kind,
      payload: JSON.parse(row.payload) as Record<string, unknown>,
      createdAt: row.notifiedAt,
      notifiedAt: row.notifiedAt,
    };
    const key = eventKey(event);
    if (!out.has(key)) out.set(key, row.notifiedAt);
  }
  return out;
}

export async function flushEvents(
  db: Db,
  send: SendFn,
  defaultChatId: number | null,
  now: number = Date.now(),
  limit = 40,
  maxAgeMs = STALE_EVENT_MS,
): Promise<FlushResult> {
  const events = pendingEvents(db, limit);
  const fresh: StoredEvent[] = [];
  const buried: number[] = [];

  for (const event of events) {
    // An availability that turned up an hour ago is no longer news; burying it
    // keeps a backlog (a bot that was offline, a chat that only just said hello)
    // from arriving as a flood.
    if (now - event.createdAt > maxAgeMs) buried.push(event.id);
    else fresh.push(event);
  }

  const fallback = defaultChatId ?? lastChat(db);
  const byWatch = new Map<string, StoredEvent[]>();
  for (const event of fresh) {
    byWatch.set(event.watchId, [...(byWatch.get(event.watchId) ?? []), event]);
  }

  const delivered: number[] = [];
  let skipped = 0;
  let messages = 0;
  let held = 0;

  for (const [watchId, watchEvents] of byWatch) {
    const watch = getWatch(db, watchId);
    const chatId = watch?.chatId ?? fallback;
    if (!watch || !chatId) {
      skipped += watchEvents.length;
      continue;
    }

    const entries = selectForDigest(watchEvents, lastToldMap(db, watchId), now);
    const best = entries[0]?.priceKop ?? null;
    const gate = readDigestGate(db, watchId);

    if (entries.length > 0 && best != null && mayTellNow(gate, best, now)) {
      const hidden = watchEvents.length - entries.length;
      await send(chatId, digestText(watch, entries, hidden));
      writeDigestGate(db, watchId, { lastSentAt: now, lastBestPriceKop: best });
      messages += 1;
      delivered.push(...watchEvents.map((event) => event.id));
    } else if (entries.length === 0) {
      delivered.push(...watchEvents.map((event) => event.id));
    } else {
      held += watchEvents.length;
    }
  }

  const closed = [...delivered, ...buried];
  if (closed.length > 0) markNotified(db, closed, now);
  return { sent: delivered.length, skipped, stale: buried.length, messages, held };
}
