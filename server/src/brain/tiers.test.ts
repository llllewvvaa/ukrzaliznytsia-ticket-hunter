import { describe, expect, it } from 'vitest';
import { applyTiers, tierOf } from './tiers.js';

const o = (kind: string, classId: string, trainNumber = '045Д', date = '2026-09-25', priceKop = 1) => ({
  kind,
  classId,
  trainNumber,
  date,
  priceKop,
});

describe('tiers', () => {
  it('orders ordinary, longer ticket, then getting off early', () => {
    expect(tierOf('direct')).toBe(1);
    expect(tierOf('board_earlier')).toBe(2);
    expect(tierOf('ride_further')).toBe(2);
    expect(tierOf('alight_earlier')).toBe(3);
  });

  it('keeps only the ordinary ticket when the class has one', () => {
    const kept = applyTiers([o('direct', 'С2'), o('board_earlier', 'С2'), o('alight_earlier', 'С2')]);
    expect(kept.map((x) => x.kind)).toEqual(['direct']);
  });

  it('falls to a longer ticket before getting off early, keeping the cheaper one', () => {
    const kept = applyTiers([o('alight_earlier', 'К', '045Д', '2026-09-25', 1), o('ride_further', 'К', '045Д', '2026-09-25', 30), o('board_earlier', 'К', '045Д', '2026-09-25', 20)]);
    expect(kept.map((x) => x.kind)).toEqual(['board_earlier']);
  });

  it('shows one run bought from two earlier stations once, at the lower price', () => {
    const kept = applyTiers([
      { kind: 'board_earlier', classId: 'П', trainNumber: '013О', date: '2026-09-19', priceKop: 24_229 },
      { kind: 'board_earlier', classId: 'П', trainNumber: '013О', date: '2026-09-19', priceKop: 22_774 },
    ]);
    expect(kept).toHaveLength(1);
    expect(kept[0]!.priceKop).toBe(22_774);
  });

  it('judges each class on its own', () => {
    const kept = applyTiers([o('direct', 'С2'), o('board_earlier', 'С1', '045Д', '2026-09-25', 5), o('alight_earlier', 'С1')]);
    expect(kept.map((x) => `${x.classId}:${x.kind}`).sort()).toEqual(['С1:board_earlier', 'С2:direct']);
  });

  it('treats купе and плацкарт separately', () => {
    const kept = applyTiers([o('direct', 'П'), o('alight_earlier', 'К')]);
    expect(kept).toHaveLength(2);
  });

  it('judges each train and day on its own', () => {
    const kept = applyTiers([o('direct', 'К', '045Д'), o('board_earlier', 'К', '081О'), o('alight_earlier', 'К', '045Д', '2026-09-26')]);
    expect(kept).toHaveLength(3);
  });
});
