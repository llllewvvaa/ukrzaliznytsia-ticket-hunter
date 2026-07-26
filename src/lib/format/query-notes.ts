// Fallback notes shown when a SW query fails — keyed by QueryResult.code.
export function trainNoteForCode(code?: string): string {
  if (code === 'not_discovered') return 'Пошук поїздів недоступний — введіть номери вручну.';
  if (code === 'not_authenticated') return 'Залогіньтесь у booking.uz, щоб бачити поїзди.';
  return 'Не вдалося завантажити поїзди. Спробуйте оновити.';
}

export function stationNoteForCode(code?: string): string {
  if (code === 'not_discovered') return 'Пошук станцій ще недоступний — введіть ID станції вручну.';
  if (code === 'not_authenticated') return 'Залогіньтесь у booking.uz, щоб шукати станції.';
  return 'Помилка пошуку станцій.';
}
