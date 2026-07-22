import { describe, it, expect } from 'vitest';
import { stationNoteForCode, trainNoteForCode } from './query-notes';

describe('trainNoteForCode', () => {
  it('maps known codes to specific hints', () => {
    expect(trainNoteForCode('not_discovered')).toBe(
      'Пошук поїздів недоступний — введіть номери вручну.',
    );
    expect(trainNoteForCode('not_authenticated')).toBe(
      'Залогіньтесь у booking.uz, щоб бачити поїзди.',
    );
  });

  it('falls back to a generic note for unknown or missing codes', () => {
    expect(trainNoteForCode('rate_limited')).toBe(
      'Не вдалося завантажити поїзди. Спробуйте оновити.',
    );
    expect(trainNoteForCode(undefined)).toBe('Не вдалося завантажити поїзди. Спробуйте оновити.');
  });
});

describe('stationNoteForCode', () => {
  it('maps known codes to specific hints', () => {
    expect(stationNoteForCode('not_discovered')).toBe(
      'Пошук станцій ще недоступний — введіть ID станції вручну.',
    );
    expect(stationNoteForCode('not_authenticated')).toBe(
      'Залогіньтесь у booking.uz, щоб шукати станції.',
    );
  });

  it('falls back to a generic note for unknown or missing codes', () => {
    expect(stationNoteForCode('error')).toBe('Помилка пошуку станцій.');
    expect(stationNoteForCode(undefined)).toBe('Помилка пошуку станцій.');
  });
});
