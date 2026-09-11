import { describe, expect, it } from 'vitest';
import { kyivDate, travelDate } from './travel-date.js';

describe('travel date', () => {
  it('reads the Kyiv calendar day, not UTC', () => {
    expect(kyivDate(Date.UTC(2026, 8, 18, 22, 43) / 1_000)).toBe('2026-09-19');
    expect(kyivDate(Date.UTC(2026, 8, 18, 20, 0) / 1_000)).toBe('2026-09-18');
  });

  it('moves a night boarding to the next day', () => {
    expect(travelDate('2026-09-18', Date.UTC(2026, 8, 18, 22, 43) / 1_000)).toBe('2026-09-19');
  });

  it('keeps the search date when the boarding time is unknown', () => {
    expect(travelDate('2026-09-18', 0)).toBe('2026-09-18');
  });

  it('follows the winter offset too', () => {
    expect(kyivDate(Date.UTC(2026, 11, 18, 22, 30) / 1_000)).toBe('2026-12-19');
    expect(kyivDate(Date.UTC(2026, 11, 18, 21, 30) / 1_000)).toBe('2026-12-18');
  });
});
