import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../store/db.js';
import { createWatch } from '../store/watches.js';
import { insertEvent, pendingEvents, recordSnapshots } from '../store/history.js';
import { flushEvents } from './notifier.js';
import { ANNOUNCE_GAP_MS, CLEAR_AFTER_MS } from './announce.js';

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

  const watchFor = (chatId: number | null = 7) =>
    createWatch(
      db,
      { fromId: 1, toId: 2, dateFrom: '2026-09-25', chatId, name: 'Львів → Чернівці' },
      1_000,
    );

  const seatsOn = (
    watchId: string,
    train: string,
    date = '2026-09-25',
    at = 2_000,
    extra: Record<string, unknown> = {},
  ) =>
    insertEvent(
      db,
      watchId,
      'appeared',
      { trainNumber: train, date, classId: 'К', priceKop: 50_000, ...extra },
      at,
    );

  it('says new tickets on the date for the route, once', async () => {
    const watch = watchFor(555);
    seatsOn(watch.id, '045Л');
    const result = await flushEvents(db, send, null, 3_000);
    expect(result.messages).toBe(1);
    expect(sent[0]!.chatId).toBe(555);
    expect(sent[0]!.text).toContain('Нові квитки · Львів → Чернівці');
    expect(sent[0]!.text).toContain('25.09');
    expect(sent[0]!.text).toContain('045Л');
  });

  it('sends a single line when one train shows up through many paths', async () => {
    const watch = watchFor();
    for (const why of [
      'прямий напрямок',
      'їхати далі',
      'сісти раніше',
      'сусідня станція',
      'пересадки від УЗ',
    ]) {
      seatsOn(watch.id, '045Л', '2026-09-25', 2_000, { why });
    }
    await flushEvents(db, send, null, 3_000);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.text.match(/045Л/g)).toHaveLength(1);
  });

  it('does not repeat a train it already announced', async () => {
    const watch = watchFor();
    seatsOn(watch.id, '045Л', '2026-09-25', 2_000);
    recordSnapshots(db, 2_000, { fromId: 1, toId: 2, date: '2026-09-25', source: 'direct' }, [
      {
        tripId: 1,
        trainNumber: '045Л',
        classId: 'К',
        className: 'К',
        freeSeats: 2,
        priceKop: 1,
        departAt: 0,
      },
    ]);
    await flushEvents(db, send, null, 3_000);
    seatsOn(watch.id, '045Л', '2026-09-25', 3_000 + ANNOUNCE_GAP_MS + 1_000);
    await flushEvents(db, send, null, 3_000 + ANNOUNCE_GAP_MS + 2_000);
    expect(sent).toHaveLength(1);
  });

  it('announces again once the train vanished and came back', async () => {
    const watch = watchFor();
    seatsOn(watch.id, '045Л', '2026-09-25', 2_000);
    await flushEvents(db, send, null, 3_000);
    const later = 3_000 + CLEAR_AFTER_MS + ANNOUNCE_GAP_MS + 10_000;
    seatsOn(watch.id, '045Л', '2026-09-25', later - 1_000);
    await flushEvents(db, send, null, later);
    expect(sent).toHaveLength(2);
  });

  it('batches a second new train that arrives inside the quiet gap', async () => {
    const watch = watchFor();
    seatsOn(watch.id, '045Л', '2026-09-25', 2_000);
    await flushEvents(db, send, null, 3_000);
    seatsOn(watch.id, '123К', '2026-09-25', 4_000);
    const held = await flushEvents(db, send, null, 5_000);
    expect(held.held).toBeGreaterThan(0);
    expect(sent).toHaveLength(1);
    await flushEvents(db, send, null, 3_000 + ANNOUNCE_GAP_MS + 1);
    expect(sent).toHaveLength(2);
    expect(sent[1]!.text).toContain('123К');
  });

  it('keeps price drops and vanished seats out of the chat', async () => {
    const watch = watchFor();
    insertEvent(
      db,
      watch.id,
      'price_drop',
      { trainNumber: '045Л', date: '2026-09-25', priceKop: 1 },
      2_000,
    );
    insertEvent(db, watch.id, 'gone', { trainNumber: '045Л', date: '2026-09-25' }, 2_000);
    await flushEvents(db, send, null, 3_000);
    expect(sent).toHaveLength(0);
    expect(pendingEvents(db)).toHaveLength(0);
  });

  it('buries a backlog instead of flooding the chat', async () => {
    const watch = watchFor();
    seatsOn(watch.id, 'OLD1', '2026-09-25', 1_000);
    seatsOn(watch.id, 'NEW1', '2026-09-25', 3_600_000);
    const result = await flushEvents(db, send, null, 3_600_000 + 1_000);
    expect(result).toMatchObject({ messages: 1, stale: 1 });
    expect(sent[0]!.text).toContain('NEW1');
    expect(sent[0]!.text).not.toContain('OLD1');
  });

  it('skips events with nowhere to go', async () => {
    const watch = watchFor(null);
    seatsOn(watch.id, '045Л');
    const result = await flushEvents(db, send, null, 3_000);
    expect(result).toMatchObject({ messages: 0, skipped: 1 });
  });
});
