import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import {
  parseSuggestStations,
  parseTimetableHtml,
  pickBestStation,
  stationQueryCandidates,
  type TimetableStation,
} from './timetable';

const html = readFileSync('fixtures/timetable-route.html', 'utf8');

describe('parseTimetableHtml', () => {
  const trains = parseTimetableHtml(html);

  it('groups rows into one entry per train number (ignores decoy tables)', () => {
    expect(trains.map((t) => t.number)).toEqual(['66', '144', '776']);
  });

  it('merges both boarding rows for a train', () => {
    const t66 = trains.find((t) => t.number === '66')!;
    expect(t66.boardings).toEqual([
      { station: 'Київ-Пас.', departTime: '23:23' },
      { station: 'Дарниця', departTime: '23:41' },
    ]);
    expect(t66.arriveStation).toBe('Суми');
    expect(t66.arriveTime).toBe('05:25');
    expect(t66.periodicity).toEqual(['з 28/06/2026 щоденно']);
    expect(t66.route).toBe('Київ Суми');
  });

  it('collects distinct periodicities for the same number', () => {
    const t144 = trains.find((t) => t.number === '144')!;
    // two service-period rows, same boarding → 2 periodicities, 1 boarding
    expect(t144.periodicity).toHaveLength(2);
    expect(t144.periodicity[0]).toContain('29/06–31/07');
    expect(t144.boardings).toEqual([{ station: 'Київ-Пас.', departTime: '04:49' }]);
  });

  it('returns [] when the schedule table is absent', () => {
    expect(parseTimetableHtml('<html><body>no table</body></html>')).toEqual([]);
  });
});

describe('parseSuggestStations', () => {
  it('splits "Name~ids" JSON entries', () => {
    const text = JSON.stringify([
      'Київ Місто (Україна)~739,47125,22080',
      'Дарниця (Україна)~22080',
      'malformed-no-tilde',
    ]);
    expect(parseSuggestStations(text)).toEqual([
      { name: 'Київ Місто (Україна)', ids: '739,47125,22080' },
      { name: 'Дарниця (Україна)', ids: '22080' },
    ]);
  });

  it('returns [] on non-JSON', () => {
    expect(parseSuggestStations('<html>')).toEqual([]);
  });

  it('returns [] for the "no match" response (literal false)', () => {
    // suggest-station answers `false` when nothing matches the query.
    expect(parseSuggestStations('false')).toEqual([]);
  });
});

describe('stationQueryCandidates', () => {
  it('widens a suffixed booking.uz name down to the city stem', () => {
    expect(stationQueryCandidates('Київ-Пасажирський')).toEqual([
      'Київ-Пасажирський',
      'Київ',
    ]);
  });

  it('collapses to a single candidate for a plain name', () => {
    expect(stationQueryCandidates('Суми')).toEqual(['Суми']);
  });

  it('drops a parenthetical qualifier', () => {
    expect(stationQueryCandidates('Одеса (Головна)')).toEqual(['Одеса (Головна)', 'Одеса']);
  });
});

describe('pickBestStation', () => {
  const list: TimetableStation[] = [
    { name: 'Кириївка(Вузьк.) (Україна)', ids: '35095' },
    { name: 'Київ Місто (Україна)', ids: '739,47125' },
    { name: 'Київ-Пас. (Україна)', ids: '22000' },
  ];

  it('prefers a prefix match over a mere substring', () => {
    expect(pickBestStation(list, 'Київ')?.ids).toBe('739,47125');
  });

  it('resolves a suffixed booking.uz name via the city stem', () => {
    // "Київ-Пасажирський" matches no timetable name in full → stem "Київ" wins.
    expect(pickBestStation(list, 'Київ-Пасажирський')?.ids).toBe('739,47125');
  });

  it('falls back to the first suggestion when nothing matches', () => {
    expect(pickBestStation(list, 'Одеса')?.ids).toBe('35095');
  });

  it('returns null for an empty list', () => {
    expect(pickBestStation([], 'Київ')).toBeNull();
  });
});
