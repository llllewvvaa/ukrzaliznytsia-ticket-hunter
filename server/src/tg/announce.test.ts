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
    expect(trains).toHaveLength(1);
    expect(trains[0]).toMatchObject({ date: '2026-09-25', trainNumber: '045Л', priceKop: 41_000 });
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
  it('gives the date, times, time on the way and the lowest price per train', () => {
    const depart = Math.floor(Date.UTC(2026, 8, 25, 12, 38) / 1_000);
    const text = announcementText(
      { name: 'Львів → Чернівці' },
      groupByDate([
        { date: '2026-09-25', trainNumber: '865Д', priceKop: 20_222, departAt: depart, arriveAt: depart + 5 * 3_600 + 32 * 60, durationMin: 332, why: '' },
        { date: '2026-09-25', trainNumber: '007К', priceKop: 29_365, departAt: depart, arriveAt: depart + 12 * 3_600, durationMin: 720, why: 'квиток від Київ-Пасажирський, посадка у Львів' },
      ]),
    );
    expect(text).toBe(
      [
        'Нові квитки · Львів → Чернівці',
        '25.09',
        '· 865Д · 15:38 → 21:10 · 5 год 32 хв · від 202.22 грн',
        '· 007К · 15:38 → 03:38 (+1) · 12 год 0 хв · від 293.65 грн',
        '  квиток від Київ-Пасажирський, посадка у Львів',
      ].join('\n'),
    );
  });
});
