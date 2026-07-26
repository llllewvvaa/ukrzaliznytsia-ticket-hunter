import { describe, it, expect } from 'vitest';
import { friendlyError, pluralHunts } from './job-format';

describe('friendlyError', () => {
  it('decodes a UZ error payload (escaped unicode) to its plain message', () => {
    const raw =
      '{"message":"\\u0425\\u0442\\u043e\\u0441\\u044c \\u0432\\u0436\\u0435 \\u043f\\u0440\\u0438\\u0434\\u0431\\u0430\\u0432 \\u0446\\u0456 \\u043a\\u0432\\u0438\\u0442\\u043a\\u0438. \\u0412\\u0438\\u0431\\u0435\\u0440\\u0456\\u0442\\u044c \\u0456\\u043d\\u0448\\u0456.","error_code":1002}';
    expect(friendlyError(raw)).toBe('Хтось вже придбав ці квитки. Виберіть інші.');
  });

  it('passes non-JSON details through unchanged', () => {
    expect(friendlyError('no_seats (wagons=0, free=0)')).toBe('no_seats (wagons=0, free=0)');
  });

  it('leaves malformed JSON untouched', () => {
    expect(friendlyError('{"message": broken')).toBe('{"message": broken');
  });

  it('returns empty string for missing input', () => {
    expect(friendlyError(undefined)).toBe('');
  });
});

describe('pluralHunts', () => {
  it('uses the singular for 1 (but not 11)', () => {
    expect(pluralHunts(1)).toBe('пошук');
    expect(pluralHunts(21)).toBe('пошук');
    expect(pluralHunts(11)).toBe('пошуків');
  });

  it('uses the paucal for 2–4 (but not 12–14)', () => {
    expect(pluralHunts(2)).toBe('пошуки');
    expect(pluralHunts(4)).toBe('пошуки');
    expect(pluralHunts(12)).toBe('пошуків');
    expect(pluralHunts(114)).toBe('пошуків');
  });

  it('uses the plural for everything else', () => {
    expect(pluralHunts(0)).toBe('пошуків');
    expect(pluralHunts(5)).toBe('пошуків');
    expect(pluralHunts(25)).toBe('пошуків');
  });
});
