import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../store/db.js';
import { createWatch } from '../store/watches.js';
import { insertEvent, pendingEvents } from '../store/history.js';
import { flushEvents } from './notifier.js';

describe('notifier', () => {
  let db: Db;
  let sent: { chatId: number; text: string }[];

  beforeEach(() => {
    db = openDb(':memory:');
    sent = [];
  });

  const send = async (chatId: number, text: string) => {
    sent.push({ chatId, text });
  };

  it('sends pending events to the chat of the watch', async () => {
    const watch = createWatch(db, { fromId: 1, toId: 2, dateFrom: '2026-09-20', chatId: 555, name: 'Дом' }, 1_000);
    insertEvent(db, watch.id, 'appeared', { trainNumber: '001К', classId: 'К', freeSeats: 2, priceKop: 40_000 }, 2_000);
    const result = await flushEvents(db, send, null, 3_000);
    expect(result.sent).toBe(1);
    expect(sent[0]!.chatId).toBe(555);
    expect(sent[0]!.text).toContain('Дом');
    expect(sent[0]!.text).toContain('001К');
  });

  it('falls back to the default chat', async () => {
    const watch = createWatch(db, { fromId: 1, toId: 2, dateFrom: '2026-09-20' }, 1_000);
    insertEvent(db, watch.id, 'appeared', { trainNumber: '002К' }, 2_000);
    await flushEvents(db, send, 777, 3_000);
    expect(sent[0]!.chatId).toBe(777);
  });

  it('buries a backlog instead of flooding the chat', async () => {
    const watch = createWatch(db, { fromId: 1, toId: 2, dateFrom: '2026-09-20', chatId: 1 }, 1_000);
    insertEvent(db, watch.id, 'appeared', { trainNumber: 'old' }, 1_000);
    insertEvent(db, watch.id, 'appeared', { trainNumber: 'fresh' }, 3_600_000);
    const result = await flushEvents(db, send, null, 3_600_000 + 1_000);
    expect(result).toMatchObject({ sent: 1, stale: 1 });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.text).toContain('fresh');
    expect(pendingEvents(db)).toHaveLength(0);
  });

  it('skips events with nowhere to go', async () => {
    const watch = createWatch(db, { fromId: 1, toId: 2, dateFrom: '2026-09-20' }, 1_000);
    insertEvent(db, watch.id, 'appeared', {}, 2_000);
    const result = await flushEvents(db, send, null, 3_000);
    expect(result).toMatchObject({ sent: 0, skipped: 1, stale: 0 });
    expect(pendingEvents(db)).toHaveLength(1);
  });

  it('sends one digest per watch, not one message per change', async () => {
    const watch = createWatch(db, { fromId: 1, toId: 2, dateFrom: '2026-09-20', chatId: 7, name: 'Дом' }, 1_000);
    for (let i = 0; i < 6; i += 1) {
      insertEvent(
        db,
        watch.id,
        'appeared',
        { tripId: i, classId: 'К', className: 'Купе', trainNumber: `00${i}К`, priceKop: 40_000 + i, freeSeats: 2 },
        2_000,
      );
    }
    const result = await flushEvents(db, send, null, 3_000);
    expect(result.messages).toBe(1);
    expect(sent).toHaveLength(1);
    expect(result.sent).toBe(6);
  });

  it('stays quiet about seats that vanished', async () => {
    const watch = createWatch(db, { fromId: 1, toId: 2, dateFrom: '2026-09-20', chatId: 7 }, 1_000);
    insertEvent(db, watch.id, 'gone', { tripId: 1, classId: 'К', trainNumber: '001К' }, 2_000);
    const result = await flushEvents(db, send, null, 3_000);
    expect(sent).toHaveLength(0);
    expect(result.messages).toBe(0);
    expect(pendingEvents(db)).toHaveLength(0);
  });

  it('never sends the same event twice', async () => {
    const watch = createWatch(db, { fromId: 1, toId: 2, dateFrom: '2026-09-20', chatId: 1 }, 1_000);
    insertEvent(db, watch.id, 'price_drop', { trainNumber: '003К', priceKop: 1_000, previousPriceKop: 5_000 }, 2_000);
    await flushEvents(db, send, null, 3_000);
    await flushEvents(db, send, null, 4_000);
    expect(sent).toHaveLength(1);
  });

  it('spells the price drop in the message', async () => {
    const watch = createWatch(db, { fromId: 1, toId: 2, dateFrom: '2026-09-20', chatId: 1 }, 1_000);
    insertEvent(
      db,
      watch.id,
      'price_drop',
      { tripId: 4, trainNumber: '004К', classId: 'К', className: 'Купе', freeSeats: 3, priceKop: 40_000, previousPriceKop: 60_000 },
      2_000,
    );
    await flushEvents(db, send, null, 3_000);
    expect(sent[0]!.text).toContain('було 600.00 грн');
  });
});
