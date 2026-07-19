import { describe, expect, it } from 'vitest';
import { localDateTimeIso, saleOpenDefault } from './date';

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
