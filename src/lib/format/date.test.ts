import { describe, expect, it } from 'vitest';
import {
  canPrevMonth,
  firstWeekday,
  formatDate,
  formatValue,
  localDateTimeIso,
  monthCells,
  parseValue,
  saleOpenDefault,
  toIso,
} from './date';

describe('saleOpenDefault', () => {
  it('is 20 days before the trip at 08:00', () => {
    expect(saleOpenDefault('2026-08-30')).toBe('2026-08-10T08:00');
  });

  it('rolls back across a month boundary', () => {
    expect(saleOpenDefault('2026-03-05')).toBe('2026-02-13T08:00');
  });

  it('rolls back across a year boundary', () => {
    expect(saleOpenDefault('2027-01-10')).toBe('2026-12-21T08:00');
  });

  it('rejects malformed input', () => {
    expect(saleOpenDefault('30.08.2026')).toBe('');
    expect(saleOpenDefault('')).toBe('');
  });
});

describe('localDateTimeIso', () => {
  it('formats as zero-padded local datetime-local string', () => {
    expect(localDateTimeIso(new Date(2026, 6, 19, 8, 5))).toBe('2026-07-19T08:05');
  });
});

describe('formatDate', () => {
  it('renders ISO dates as DD.MM.YYYY', () => {
    expect(formatDate('2026-08-30')).toBe('30.08.2026');
  });

  it('passes non-ISO input through unchanged', () => {
    expect(formatDate('30.08.2026')).toBe('30.08.2026');
    expect(formatDate('')).toBe('');
  });
});

describe('parseValue', () => {
  it('parses a bare date with the default 08:00 time', () => {
    expect(parseValue('2026-08-30')).toEqual({ y: 2026, m: 7, d: 30, hh: 8, mm: 0 });
  });

  it('parses a datetime with explicit time', () => {
    expect(parseValue('2026-08-30T14:05')).toEqual({ y: 2026, m: 7, d: 30, hh: 14, mm: 5 });
  });

  it('rejects malformed input', () => {
    expect(parseValue('30.08.2026')).toBeNull();
    expect(parseValue('')).toBeNull();
    expect(parseValue('2026-08-30T14')).toBeNull();
  });
});

describe('toIso', () => {
  it('zero-pads month and day', () => {
    expect(toIso(2026, 0, 5)).toBe('2026-01-05');
  });
});

describe('formatValue', () => {
  it('renders a date as DD.MM.YYYY', () => {
    expect(formatValue('2026-08-30', false)).toBe('30.08.2026');
  });

  it('renders a datetime with time', () => {
    expect(formatValue('2026-08-30T14:05', true)).toBe('30.08.2026, 14:05');
  });

  it('shows a placeholder for empty input', () => {
    expect(formatValue('', false)).toBe('Оберіть дату');
    expect(formatValue('', true)).toBe('Оберіть дату й час');
  });
});

describe('firstWeekday', () => {
  it('is Monday-based (Monday = 0)', () => {
    // 2026-06-01 is a Monday
    expect(firstWeekday(2026, 5)).toBe(0);
    // 2026-07-01 is a Wednesday
    expect(firstWeekday(2026, 6)).toBe(2);
  });
});

describe('monthCells', () => {
  it('pads leading blanks so the 1st matches its weekday', () => {
    const cells = monthCells(2026, 6); // July 2026 starts on Wednesday
    expect(cells.slice(0, 5)).toEqual([null, null, 1, 2, 3]);
    expect(cells).toHaveLength(2 + 31);
  });

  it('handles February in a leap year', () => {
    const cells = monthCells(2028, 1);
    expect(cells.filter((c) => c !== null)).toHaveLength(29);
  });
});

describe('canPrevMonth', () => {
  it('forbids going before the min month', () => {
    const min = new Date(2026, 6, 15);
    expect(canPrevMonth(2026, 6, min)).toBe(false);
    expect(canPrevMonth(2026, 7, min)).toBe(true);
  });
});
