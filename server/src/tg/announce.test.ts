import { describe, expect, it } from 'vitest';
import { announcementText, groupByDate, newTrainsFrom } from './announce.js';
import type { StoredEvent } from '../store/history.js';

function appeared(payload: Record<string, unknown>, kind = 'appeared'): StoredEvent {
  return { id: 1, watchId: 'w', kind, payload, createdAt: 1, notifiedAt: null };
}

describe('newTrainsFrom', () => {
  it('counts one train once however many paths and classes it came through', () => {
    const trains = newTrainsFrom([
      appeared({ date: '2026-09-25', trainNumber: '045Л', classId: 'К', priceKop: 60_000, why: 'прямий напрямок' }),
      appeared({ date: '2026-09-25', trainNumber: '045Л', classId: 'П', priceKop: 41_000, why: 'їхати далі до Вадул-Сірет' }),
      appeared({ date: '2026-09-25', trainNumber: '045Л', classId: 'MIX:1-2', priceKop: 70_000, why: 'пересадки від УЗ' }),
    ]);
    expect(trains).toEqual([{ date: '2026-09-25', trainNumber: '045Л', priceKop: 41_000 }]);
  });

  it('keeps the same train on different days apart', () => {
    const trains = newTrainsFrom([
      appeared({ date: '2026-09-25', trainNumber: '045Л', priceKop: 1 }),
      appeared({ date: '2026-09-26', trainNumber: '045Л', priceKop: 1 }),
    ]);
    expect(trains).toHaveLength(2);
  });

  it('ignores price drops and vanished seats', () => {
    expect(newTrainsFrom([appeared({ date: '2026-09-25', trainNumber: '045Л' }, 'price_drop')])).toEqual([]);
    expect(newTrainsFrom([appeared({ date: '2026-09-25', trainNumber: '045Л' }, 'gone')])).toEqual([]);
  });
});

describe('announcement text', () => {
  it('reads as new tickets on a date for the route', () => {
    const text = announcementText(
      { name: 'Львів → Чернівці' },
      groupByDate([
        { date: '2026-09-25', trainNumber: '123К', priceKop: 45_000 },
        { date: '2026-09-25', trainNumber: '045Л', priceKop: 41_000 },
        { date: '2026-09-26', trainNumber: '123К', priceKop: 39_800 },
      ]),
    );
    expect(text).toBe('Нові квитки · Львів → Чернівці\n25.09 — 045Л, 123К · від 410.00 грн\n26.09 — 123К · від 398.00 грн');
  });
});
