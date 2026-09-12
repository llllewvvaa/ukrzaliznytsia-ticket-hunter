import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../store/db.js';
import { createWatch } from '../store/watches.js';
import { insertEvent } from '../store/history.js';
import { lastChat, rememberChat } from '../store/meta.js';
import { flushEvents } from './notifier.js';

describe('remembered chat', () => {
  let db: Db;

  beforeEach(() => {
    db = openDb(':memory:');
  });

  const seats = (watchId: string) =>
    insertEvent(
      db,
      watchId,
      'appeared',
      { trainNumber: '001К', date: '2026-09-20', priceKop: 1 },
      2_000,
    );

  it('stores and reads the last chat that talked to the bot', () => {
    expect(lastChat(db)).toBeNull();
    rememberChat(db, 4242);
    expect(lastChat(db)).toBe(4242);
  });

  it('delivers to the remembered chat when nothing else is known', async () => {
    rememberChat(db, 4242);
    const watch = createWatch(db, { fromId: 1, toId: 2, dateFrom: '2026-09-20' }, 1_000);
    seats(watch.id);
    const sent: number[] = [];
    await flushEvents(
      db,
      async (chatId) => {
        sent.push(chatId);
      },
      null,
      3_000,
    );
    expect(sent).toEqual([4242]);
  });

  it('still prefers the chat the watch belongs to', async () => {
    rememberChat(db, 4242);
    const watch = createWatch(
      db,
      { fromId: 1, toId: 2, dateFrom: '2026-09-20', chatId: 999 },
      1_000,
    );
    seats(watch.id);
    const sent: number[] = [];
    await flushEvents(
      db,
      async (chatId) => {
        sent.push(chatId);
      },
      null,
      3_000,
    );
    expect(sent).toEqual([999]);
  });
});
