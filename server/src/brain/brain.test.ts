import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../store/db.js';
import { saveTripRoute } from '../store/atlas.js';
import { parseSearch } from '../uz/parse.js';
import { expandDates, networkCost, planCandidates, shiftDate } from './candidates.js';
import { cheapest, offersFromSearch, pricePerKm, rankOffers, scoreOffer } from './rank.js';
import type { TripDetail } from '../uz/types.js';

function line(): TripDetail {
  return {
    id: 900,
    trainId: 90,
    trainNumber: '777Т',
    stationFromId: 20,
    stationToId: 40,
    departAt: 1_000,
    arriveAt: 5_000,
    routePoints: [
      { seq: 0, stationId: 10, stationName: 'Альфа', arriveAt: null, departAt: 900 },
      { seq: 1, stationId: 20, stationName: 'Бета', arriveAt: 1_000, departAt: 1_100 },
      { seq: 2, stationId: 30, stationName: 'Гама', arriveAt: 2_100, departAt: 2_160 },
      { seq: 3, stationId: 40, stationName: 'Дельта', arriveAt: 3_000, departAt: 3_100 },
      { seq: 4, stationId: 50, stationName: 'Епсілон', arriveAt: 4_000, departAt: null },
    ],
  };
}

describe('dates', () => {
  it('shifts forward and back across a month edge', () => {
    expect(shiftDate('2026-09-30', 1)).toBe('2026-10-01');
    expect(shiftDate('2026-10-01', -1)).toBe('2026-09-30');
  });

  it('expands a window symmetrically', () => {
    expect(expandDates(['2026-09-10'], 1)).toEqual(['2026-09-09', '2026-09-10', '2026-09-11']);
  });
});

describe('planCandidates', () => {
  let db: Db;

  beforeEach(() => {
    db = openDb(':memory:');
    saveTripRoute(db, line(), 1_000);
  });

  it('always covers the direct pair', () => {
    const plan = planCandidates(db, { fromId: 20, toId: 40, dates: ['2026-09-10'] });
    expect(plan.some((c) => c.kind === 'direct')).toBe(true);
  });

  it('asks UZ for its own transfer variants', () => {
    const plan = planCandidates(db, { fromId: 20, toId: 40, dates: ['2026-09-10'] });
    expect(plan.some((c) => c.kind === 'transfers' && c.withTransfers)).toBe(true);
  });

  it('searches the day before for boarding earlier, not for the other kinds', () => {
    const plan = planCandidates(db, { fromId: 20, toId: 40, dates: ['2026-09-10'] });
    const earlierDates = plan.filter((c) => c.kind === 'board_earlier').map((c) => c.date).sort();
    const furtherDates = plan.filter((c) => c.kind === 'ride_further').map((c) => c.date);
    expect(earlierDates).toEqual(['2026-09-09', '2026-09-10']);
    expect(furtherDates).toEqual(['2026-09-10']);
  });

  it('offers riding further and boarding earlier from the atlas', () => {
    const plan = planCandidates(db, { fromId: 20, toId: 40, dates: ['2026-09-10'] });
    const further = plan.find((c) => c.kind === 'ride_further');
    const earlier = plan.find((c) => c.kind === 'board_earlier');
    expect(further?.toId).toBe(50);
    expect(earlier?.fromId).toBe(10);
  });

  it('never plans a ticket that would leave you short or unable to board', () => {
    const plan = planCandidates(db, { fromId: 20, toId: 40, dates: ['2026-09-10'] });
    expect(plan.some((c) => c.kind === 'neighbor_from' || c.kind === 'neighbor_to')).toBe(false);
  });

  it('adds neighbouring dates only when slack is asked for', () => {
    const tight = planCandidates(db, { fromId: 20, toId: 40, dates: ['2026-09-10'] });
    const loose = planCandidates(db, { fromId: 20, toId: 40, dates: ['2026-09-10'], dateSlack: 1 });
    expect(tight.some((c) => c.kind === 'neighbor_date')).toBe(false);
    expect(loose.filter((c) => c.kind === 'neighbor_date')).toHaveLength(2);
  });

  it('never plans a journey from a station to itself', () => {
    const plan = planCandidates(db, { fromId: 20, toId: 40, dates: ['2026-09-10'], dateSlack: 2 });
    expect(plan.every((c) => c.fromId !== c.toId)).toBe(true);
  });

  it('offers getting off a stop early only when the train is minutes from the destination', () => {
    const near = planCandidates(db, { fromId: 20, toId: 40, dates: ['2026-09-10'], alightEarlierMin: 20 });
    const early = near.filter((c) => c.kind === 'alight_earlier');
    expect(early).toHaveLength(1);
    expect(early[0]!.toId).toBe(30);
    expect(early[0]!.why).toContain('за 15 хв до мети');
  });

  it('skips getting off early when the gap is over the limit or the option is off', () => {
    expect(planCandidates(db, { fromId: 20, toId: 40, dates: ['2026-09-10'], alightEarlierMin: 10 }).some((c) => c.kind === 'alight_earlier')).toBe(false);
    expect(planCandidates(db, { fromId: 20, toId: 40, dates: ['2026-09-10'], alightEarlierMin: 0 }).some((c) => c.kind === 'alight_earlier')).toBe(false);
  });

  it('never repeats the same pair-date-mode', () => {
    const plan = planCandidates(db, { fromId: 20, toId: 40, dates: ['2026-09-10', '2026-09-11'] });
    expect(networkCost(plan)).toBe(plan.length);
  });

  it('costs nothing in network calls', () => {
    const before = db.prepare('select count(*) as n from request_log').get() as unknown as { n: number };
    planCandidates(db, { fromId: 20, toId: 40, dates: ['2026-09-10'], dateSlack: 2 });
    const after = db.prepare('select count(*) as n from request_log').get() as unknown as { n: number };
    expect(after.n).toBe(before.n);
  });

  it('respects the caps', () => {
    const plan = planCandidates(db, {
      fromId: 20,
      toId: 40,
      dates: ['2026-09-10'],
      maxSegmentOptions: 1,
    });
    expect(plan.filter((c) => c.kind === 'ride_further' || c.kind === 'board_earlier')).toHaveLength(1);
  });
});

describe('ranking real search data', () => {
  const search = parseSearch(
    JSON.parse(readFileSync(new URL('../../fixtures/search-kyiv-lviv.json', import.meta.url), 'utf-8')),
  );
  const candidate = {
    fromId: 2200001,
    toId: 2218000,
    date: '2026-09-08',
    kind: 'direct' as const,
    withTransfers: false,
    weight: 1,
    why: 'прямий напрямок',
  };

  it('keeps the legs of a transfer variant with names and times', () => {
    const variant = parseSearch({
      direct: [],
      with_transfer: [
        [
          {
            id: 1,
            depart_at: 1_000,
            arrive_at: 5_000,
            station_from: 'Львів',
            station_to: 'Тернопіль',
            train: { id: 1, number: '111К', wagon_classes: [{ id: 'К', name: 'Купе', free_seats: 3, price: 20_000 }] },
          },
          {
            id: 2,
            depart_at: 8_000,
            arrive_at: 12_000,
            station_from: 'Тернопіль',
            station_to: 'Чернівці',
            train: { id: 2, number: '222П', wagon_classes: [{ id: 'П', name: 'Плацкарт', free_seats: 5, price: 15_000 }] },
          },
        ],
      ],
    });
    const offers = offersFromSearch(variant, { ...candidate, kind: 'transfers', withTransfers: true });
    const transfer = offers.find((o) => o.segments)!;
    expect(transfer.trainNumber).toBe('111К + 222П');
    expect(transfer.priceKop).toBe(35_000);
    expect(transfer.segments!.map((l) => `${l.from}-${l.to}`)).toEqual(['Львів-Тернопіль', 'Тернопіль-Чернівці']);
    expect(transfer.arriveAt).toBe(12_000);
  });

  it('ignores transfer variants unless the candidate asked for them', () => {
    const withTransfers = { ...candidate, withTransfers: true, kind: 'transfers' as const };
    const plain = offersFromSearch(search, candidate);
    const mixed = offersFromSearch(search, withTransfers);
    expect(plain.every((o) => !o.classId.startsWith('MIX'))).toBe(true);
    expect(mixed.length).toBeGreaterThanOrEqual(plain.length);
  });

  it('keeps only classes that actually have seats', () => {
    const offers = offersFromSearch(search, candidate);
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.every((o) => o.freeSeats > 0)).toBe(true);
  });

  it('puts the cheapest offer first by default', () => {
    const offers = rankOffers(offersFromSearch(search, candidate));
    expect(offers[0]!.priceKop).toBe(cheapest(offers)!.priceKop);
  });

  it('balanced mode may prefer a faster ride over the absolute cheapest', () => {
    const offers = offersFromSearch(search, candidate);
    const balanced = rankOffers(offers, {}, undefined, 'balanced');
    const cheap = rankOffers(offers, {}, undefined, 'cheapest');
    expect(balanced[0]!.score).toBeLessThanOrEqual(cheap[0]!.score);
  });

  it('filters by class and price ceiling', () => {
    const offers = offersFromSearch(search, candidate);
    const filtered = rankOffers(offers, { classes: ['К'], maxPriceKop: 60_000 });
    expect(filtered.every((o) => o.classId === 'К' && o.priceKop <= 60_000)).toBe(true);
  });

  it('prefers a direct ride over a detour at equal price', () => {
    const base = offersFromSearch(search, candidate)[0]!;
    const detour = { ...base, kind: 'neighbor_from' as const };
    expect(scoreOffer(base)).toBeLessThan(scoreOffer(detour));
  });

  it('computes price per kilometre when distance is known', () => {
    const offer = offersFromSearch(search, candidate)[0]!;
    expect(pricePerKm(offer)).toBeGreaterThan(0);
  });
});
