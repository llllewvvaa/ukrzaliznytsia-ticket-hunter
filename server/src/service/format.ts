import type { Offer } from '../brain/rank.js';
import type { StoredEvent } from '../store/history.js';

export function hryvnia(kop: number): string {
  return `${(kop / 100).toFixed(2)} грн`;
}

export function kyivClock(unixSeconds: number): string {
  return new Date(unixSeconds * 1_000).toLocaleTimeString('uk-UA', {
    timeZone: 'Europe/Kyiv',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function shortDate(iso: string): string {
  const [, month, day] = iso.split('-');
  return month && day ? `${day}.${month}` : iso;
}

export function kyivTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1_000).toLocaleString('uk-UA', {
    timeZone: 'Europe/Kyiv',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function describeOffer(offer: Offer): string {
  const hours = Math.floor(offer.durationMin / 60);
  const minutes = offer.durationMin % 60;
  const detour = offer.kind === 'direct' ? '' : ` · ${offer.why}`;
  return `${offer.trainNumber} ${kyivTime(offer.departAt)} → ${kyivTime(offer.arriveAt)} (${hours}г ${minutes}хв) · ${offer.className} ×${offer.freeSeats} · ${hryvnia(offer.priceKop)}${detour}`;
}

const EVENT_TITLE: Record<string, string> = {
  appeared: 'Зʼявилися місця',
  price_drop: 'Ціна впала',
  more_seats: 'Більше місць',
  gone: 'Місця зникли',
};

export function describeEvent(event: StoredEvent): string {
  const payload = event.payload as Record<string, unknown>;
  const title = EVENT_TITLE[event.kind] ?? event.kind;
  const train = String(payload.trainNumber ?? '');
  const className = String(payload.className ?? payload.classId ?? '');
  const price = Number(payload.priceKop ?? 0);
  const seats = Number(payload.freeSeats ?? 0);
  const date = String(payload.date ?? '');
  const why = String(payload.why ?? '');

  const head = `${title}: ${train} ${date} · ${className} ×${seats} · ${hryvnia(price)}`;
  const lines = [head];

  if (event.kind === 'price_drop' && payload.previousPriceKop != null) {
    lines.push(`було ${hryvnia(Number(payload.previousPriceKop))}`);
  }
  if (why && why !== 'прямий напрямок') lines.push(`варіант: ${why}`);

  const seatList = Array.isArray(payload.seats) ? (payload.seats as Record<string, unknown>[]) : [];
  for (const wagon of seatList.slice(0, 3)) {
    const numbers = Array.isArray(wagon.seats) ? (wagon.seats as number[]).join(', ') : '';
    lines.push(
      `вагон ${String(wagon.wagon)} · нижніх ${Number(wagon.lower)}, верхніх ${Number(wagon.upper)} · ${numbers}`,
    );
  }

  return lines.join('\n');
}
