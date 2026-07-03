import type { OrderTicket, OrderTicketReservation, Station, UserOrder } from './models';

// A station field may arrive as a plain string or as a `{id, name}` object depending on endpoint.
export function stationText(v: string | Station | null | undefined): string {
  if (typeof v === 'string') return v;
  return v?.name ?? '';
}

export function hryvnia(kopecks: number | undefined): string {
  const amount = (Number(kopecks) || 0) / 100;
  return `${amount.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₴`;
}

export function tripDateTime(unixSec: number | undefined): string {
  if (!unixSec) return '—';
  const d = new Date(unixSec * 1000);
  const date = d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' });
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}

export function hhmm(unixSec: number | undefined): string {
  if (!unixSec) return '—';
  return new Date(unixSec * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function dayLabel(unixSec: number | undefined): string {
  if (!unixSec) return '';
  return new Date(unixSec * 1000).toLocaleDateString('uk-UA', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
}

export function durationLabel(departSec: number | undefined, arriveSec: number | undefined): string {
  if (!departSec || !arriveSec || arriveSec <= departSec) return '';
  const mins = Math.round((arriveSec - departSec) / 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} хв`;
  return m === 0 ? `${h} год` : `${h} год ${m} хв`;
}

export function overnightDays(departSec: number | undefined, arriveSec: number | undefined): number {
  if (!departSec || !arriveSec) return 0;
  const startOfDay = (s: number): number => {
    const d = new Date(s * 1000);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  return Math.round((startOfDay(arriveSec) - startOfDay(departSec)) / 86_400_000);
}

export function passengerName(res: OrderTicketReservation): string {
  return `${res.first_name} ${res.last_name}`.trim();
}

export function seatLabel(res: OrderTicketReservation): string {
  return `${res.wagon_number} вагон · ${res.seat_number} місце`;
}

export function orderTotal(order: UserOrder): number {
  return (order.tickets ?? []).reduce(
    (sum, t) => sum + (Number(t.reservation?.price) || 0),
    0,
  );
}

export function isReturned(ticket: OrderTicket): boolean {
  return ticket.returned_at != null;
}
