import type { Db } from '../store/db.js';
import { markNotified, pendingEvents, type StoredEvent } from '../store/history.js';
import { getWatch } from '../store/watches.js';
import { lastChat } from '../store/meta.js';
import { describeEvent } from '../service/format.js';

export type SendFn = (chatId: number, text: string) => Promise<void>;

export interface FlushResult {
  sent: number;
  skipped: number;
}

export function eventText(db: Db, event: StoredEvent): string {
  const watch = getWatch(db, event.watchId);
  const head = watch ? `[${watch.name}]` : '[стеження]';
  return `${head}\n${describeEvent(event)}`;
}

export async function flushEvents(
  db: Db,
  send: SendFn,
  defaultChatId: number | null,
  now: number = Date.now(),
  limit = 20,
): Promise<FlushResult> {
  const events = pendingEvents(db, limit);
  const delivered: number[] = [];
  let skipped = 0;

  const fallback = defaultChatId ?? lastChat(db);
  for (const event of events) {
    const watch = getWatch(db, event.watchId);
    const chatId = watch?.chatId ?? fallback;
    if (!chatId) {
      skipped += 1;
      continue;
    }
    await send(chatId, eventText(db, event));
    delivered.push(event.id);
  }

  if (delivered.length > 0) markNotified(db, delivered, now);
  return { sent: delivered.length, skipped };
}
