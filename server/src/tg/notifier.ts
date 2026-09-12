import type { Db } from '../store/db.js';
import { markNotified, pendingEvents, type StoredEvent } from '../store/history.js';
import { getWatch } from '../store/watches.js';
import { getMeta, lastChat, setMeta } from '../store/meta.js';
import {
  ANNOUNCE_GAP_MS,
  alreadyAnnounced,
  announcementText,
  clearVanished,
  groupByDate,
  markAnnounced,
  newTrainsFrom,
} from './announce.js';

export type SendFn = (chatId: number, text: string) => Promise<void>;

export interface FlushResult {
  sent: number;
  skipped: number;
  stale: number;
  messages: number;
  held: number;
}

export const STALE_EVENT_MS = 30 * 60_000;

function lastAnnouncedAt(db: Db, watchId: string): number | null {
  const raw = getMeta(db, `announce:${watchId}`);
  return raw ? Number(raw) : null;
}

export async function flushEvents(
  db: Db,
  send: SendFn,
  defaultChatId: number | null,
  now: number = Date.now(),
  limit = 200,
  maxAgeMs = STALE_EVENT_MS,
): Promise<FlushResult> {
  clearVanished(db, now);

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

    const news = newTrainsFrom(watchEvents).filter(
      (train) => !alreadyAnnounced(db, watchId, train.date, train.trainNumber),
    );
    if (news.length === 0) {
      delivered.push(...watchEvents.map((event) => event.id));
      continue;
    }

    const last = lastAnnouncedAt(db, watchId);
    if (last != null && now - last < ANNOUNCE_GAP_MS) {
      held += watchEvents.length;
      continue;
    }

    await send(chatId, announcementText(watch, groupByDate(news)));
    markAnnounced(db, watchId, news, now);
    setMeta(db, `announce:${watchId}`, String(now));
    messages += 1;
    delivered.push(...watchEvents.map((event) => event.id));
  }

  const closed = [...delivered, ...buried];
  if (closed.length > 0) markNotified(db, closed, now);
  return { sent: delivered.length, skipped, stale: buried.length, messages, held };
}
