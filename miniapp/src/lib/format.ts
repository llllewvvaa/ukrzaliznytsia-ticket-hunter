export function hryvnia(kop: number): string {
  return `${(kop / 100).toFixed(2)} грн`;
}

export function hryvniaShort(kop: number): string {
  return `${Math.round(kop / 100)} ₴`;
}

export function clockTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1_000).toLocaleTimeString('uk-UA', {
    timeZone: 'Europe/Kyiv',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function shortDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return year && month && day ? `${day}.${month}` : iso;
}

export function dateRange(from: string, to: string): string {
  return from === to ? shortDate(from) : `${shortDate(from)} — ${shortDate(to)}`;
}

export function duration(minutes: number): string {
  return `${Math.floor(minutes / 60)} год ${minutes % 60} хв`;
}

export function relTime(ms: number | null | undefined, now = Date.now()): string {
  if (!ms) return 'ще не було';
  const diff = Math.max(0, now - ms);
  if (diff < 60_000) return 'щойно';
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)} хв тому`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)} год тому`;
  return `${Math.round(diff / 86_400_000)} дн тому`;
}

export function isoDate(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export function shiftIso(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function kyivDay(unixSeconds: number): string {
  return new Date(unixSeconds * 1_000).toLocaleDateString('uk-UA', { timeZone: 'Europe/Kyiv' });
}

export function nextDayMark(departAt: number, arriveAt: number): string {
  return departAt && arriveAt && kyivDay(departAt) !== kyivDay(arriveAt) ? '+1' : '';
}

export function waitBetween(arriveAt: number, departAt: number): string {
  const minutes = Math.max(0, Math.round((departAt - arriveAt) / 60));
  return minutes >= 60 ? `${Math.floor(minutes / 60)} год ${minutes % 60} хв` : `${minutes} хв`;
}
