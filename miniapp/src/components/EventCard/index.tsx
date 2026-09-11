import { Badge } from '../ui';
import { DetourIcon, PriceDownIcon, SeatIcon } from '../icons';
import { hryvnia, relTime, shortDate } from '../../lib/format';
import type { WatchEvent } from '../../types';

const KIND: Record<string, { title: string; tone: string }> = {
  appeared: { title: 'зʼявилися місця', tone: 'bg-emerald-50 text-emerald-700' },
  price_drop: { title: 'ціна впала', tone: 'bg-blue-50 text-blue-700' },
  more_seats: { title: 'більше місць', tone: 'bg-emerald-50 text-emerald-700' },
  gone: { title: 'місця зникли', tone: 'bg-gray-100 text-gray-600' },
};

interface SeatBlock {
  wagon?: string;
  lower?: number;
  upper?: number;
  seats?: number[];
  adjacent?: number;
}

export function EventCard({ event }: { event: WatchEvent }) {
  const payload = event.payload as Record<string, unknown>;
  const kind = KIND[event.kind] ?? { title: event.kind, tone: 'bg-gray-100 text-gray-600' };
  const seats = Array.isArray(payload.seats) ? (payload.seats as SeatBlock[]) : [];
  const why = String(payload.why ?? '');
  const previousPrice = payload.previousPriceKop == null ? null : Number(payload.previousPriceKop);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-semibold text-gray-900">
          {String(payload.trainNumber ?? '')}
          <span className="ml-1.5 text-xs font-normal text-gray-500">
            {shortDate(String(payload.date ?? ''))} ·{' '}
            {String(payload.className ?? payload.classId ?? '')}
          </span>
        </div>
        <Badge tone={kind.tone}>{kind.title}</Badge>
      </div>

      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-lg font-bold text-gray-900">
          {hryvnia(Number(payload.priceKop ?? 0))}
        </span>
        {previousPrice != null && event.kind === 'price_drop' ? (
          <span className="flex items-center gap-1 text-xs text-gray-400 line-through">
            <PriceDownIcon className="h-3.5 w-3.5 text-blue-500" /> {hryvnia(previousPrice)}
          </span>
        ) : null}
        <span className="ml-auto text-xs text-gray-500">
          вільних {Number(payload.freeSeats ?? 0)} · {relTime(event.createdAt)}
        </span>
      </div>

      {why && why !== 'прямий напрямок' ? (
        <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-50/60 px-2.5 py-1.5 text-[11px] leading-snug text-amber-800">
          <DetourIcon className="h-3.5 w-3.5 shrink-0 text-amber-600" /> {why}
        </div>
      ) : null}

      {seats.length > 0 ? (
        <div className="mt-2 space-y-1">
          {seats.slice(0, 3).map((wagon, index) => (
            <div
              key={index}
              className="flex items-start gap-1.5 text-[11px] leading-snug text-gray-600"
            >
              <SeatIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
              <span>
                вагон {String(wagon.wagon ?? '')} · нижніх {Number(wagon.lower ?? 0)}, верхніх{' '}
                {Number(wagon.upper ?? 0)}
                {Array.isArray(wagon.seats) && wagon.seats.length > 0
                  ? ` · місця ${wagon.seats.slice(0, 10).join(', ')}`
                  : ''}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
