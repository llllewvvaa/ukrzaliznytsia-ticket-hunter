import { describe, expect, it } from 'vitest';
import { COOLDOWN_MS, DIGEST_GAP_MS, digestText, eventKey, isWorthTelling, mayTellNow, selectForDigest } from './digest.js';
import type { StoredEvent } from '../store/history.js';
import type { Watch } from '../store/watches.js';

function event(over: Partial<StoredEvent> & { payload?: Record<string, unknown> } = {}): StoredEvent {
  return {
    id: 1,
    watchId: 'w1',
    kind: 'appeared',
    createdAt: 1_000,
    notifiedAt: null,
    ...over,
    payload: {
      tripId: 10,
      classId: 'К',
      className: 'Купе',
      trainNumber: '001К',
      freeSeats: 2,
      priceKop: 50_000,
      date: '2026-09-20',
      why: 'прямий напрямок',
      ...(over.payload ?? {}),
    },
  };
}

const watch = { id: 'w1', name: 'Київ → Львів' } as Watch;

describe('digest selection', () => {
  it('tells only about appearances and price drops', () => {
    expect(isWorthTelling(event({ kind: 'appeared' }))).toBe(true);
    expect(isWorthTelling(event({ kind: 'price_drop' }))).toBe(true);
    expect(isWorthTelling(event({ kind: 'gone' }))).toBe(false);
    expect(isWorthTelling(event({ kind: 'more_seats' }))).toBe(false);
  });

  it('collapses transfer combinations of the same train into one line', () => {
    const entries = selectForDigest(
      [
        event({ id: 1, payload: { classId: 'MIX:1-2', className: '2 сегменти', priceKop: 90_000 } }),
        event({ id: 2, payload: { classId: 'MIX:3-4', className: '2 сегменти', priceKop: 80_000 } }),
      ],
      new Map(),
      2_000,
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]!.priceKop).toBe(80_000);
  });

  it('keeps the cheapest sighting of the same trip and class', () => {
    const entries = selectForDigest(
      [event({ id: 1, payload: { priceKop: 60_000 } }), event({ id: 2, payload: { priceKop: 40_000 } })],
      new Map(),
      2_000,
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]!.priceKop).toBe(40_000);
  });

  it('stays silent about something it already reported recently', () => {
    const one = event();
    const told = new Map([[eventKey(one), 2_000]]);
    expect(selectForDigest([one], told, 2_000 + COOLDOWN_MS - 1)).toHaveLength(0);
  });

  it('speaks again once the cooldown passes', () => {
    const one = event();
    const told = new Map([[eventKey(one), 2_000]]);
    expect(selectForDigest([one], told, 2_000 + COOLDOWN_MS + 1)).toHaveLength(1);
  });

  it('never sends more than five lines at once', () => {
    const many = Array.from({ length: 12 }, (_, index) =>
      event({ id: index, payload: { tripId: index, trainNumber: `00${index}К`, priceKop: 10_000 + index } }),
    );
    expect(selectForDigest(many, new Map(), 2_000)).toHaveLength(5);
  });

  it('puts the cheapest first', () => {
    const entries = selectForDigest(
      [
        event({ id: 1, payload: { tripId: 1, trainNumber: '111К', priceKop: 90_000 } }),
        event({ id: 2, payload: { tripId: 2, trainNumber: '222К', priceKop: 30_000 } }),
      ],
      new Map(),
      2_000,
    );
    expect(entries[0]!.priceKop).toBe(30_000);
  });
});

describe('digest text', () => {
  it('reads as one message with the route on top', () => {
    const text = digestText(watch, selectForDigest([event()], new Map(), 2_000), 0);
    expect(text.split('\n')[0]).toBe('Київ → Львів');
    expect(text).toContain('001К');
    expect(text).toContain('20.09');
    expect(text).toContain('500.00 грн');
  });

  it('spells out the previous price on a drop', () => {
    const drop = event({ kind: 'price_drop', payload: { priceKop: 40_000, previousPriceKop: 60_000 } });
    const text = digestText(watch, selectForDigest([drop], new Map(), 2_000), 0);
    expect(text).toContain('було 600.00 грн');
  });

  it('explains a detour and shows the seats', () => {
    const detour = event({
      payload: {
        why: 'їхати далі до Славсько потягом 017О',
        seats: [{ wagon: '3', lower: 0, upper: 7, seats: [10, 18, 20] }],
      },
    });
    const text = digestText(watch, selectForDigest([detour], new Map(), 2_000), 0);
    expect(text).toContain('їхати далі до Славсько');
    expect(text).toContain('вагон 3');
    expect(text).toContain('10, 18, 20');
  });

  it('says how much it left out', () => {
    const text = digestText(watch, selectForDigest([event()], new Map(), 2_000), 7);
    expect(text).toContain('ще 7');
  });
});

describe('digest gate', () => {
  it('speaks freely the first time', () => {
    expect(mayTellNow({ lastSentAt: null, lastBestPriceKop: null }, 50_000, 1_000)).toBe(true);
  });

  it('keeps quiet inside the gap when nothing got cheaper', () => {
    const gate = { lastSentAt: 1_000, lastBestPriceKop: 50_000 };
    expect(mayTellNow(gate, 50_000, 1_000 + DIGEST_GAP_MS - 1)).toBe(false);
  });

  it('breaks the quiet for a clearly cheaper find', () => {
    const gate = { lastSentAt: 1_000, lastBestPriceKop: 50_000 };
    expect(mayTellNow(gate, 40_000, 1_000 + 60_000)).toBe(true);
  });

  it('speaks again once the gap has passed', () => {
    const gate = { lastSentAt: 1_000, lastBestPriceKop: 10_000 };
    expect(mayTellNow(gate, 90_000, 1_000 + DIGEST_GAP_MS + 1)).toBe(true);
  });
});
