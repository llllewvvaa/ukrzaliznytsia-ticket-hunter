import { Badge } from '../ui';
import { DetourIcon, TrainIcon } from '../icons';
import { clockTime, duration, hryvnia, nextDayMark, shortDate } from '../../lib/format';
import { Segments } from '../Segments';
import type { Offer } from '../../types';

const KIND_LABEL: Record<string, string> = {
  direct: 'прямий',
  transfers: 'з пересадкою',
  ride_further: 'їхати далі',
  board_earlier: 'сісти раніше',
  neighbor_date: 'сусідня дата',
  alight_earlier: 'вийти раніше',
};

export function OfferCard({
  offer,
  cheapest,
  onWatch,
}: {
  offer: Offer;
  cheapest: boolean;
  onWatch?: (offer: Offer) => void;
}) {
  const detour = offer.kind !== 'direct';

  return (
    <div
      className={`rounded-xl border bg-white p-4 shadow-sm transition-shadow duration-200 hover:shadow-md ${
        cheapest ? 'border-blue-500 ring-1 ring-blue-500/30' : 'border-gray-200'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          <TrainIcon className="h-4 w-4 text-gray-400" />
          {offer.trainNumber}
          <span className="text-xs font-normal text-gray-500">· {shortDate(offer.date)}</span>
        </div>
        {cheapest ? <Badge tone="bg-blue-50 text-blue-700">найдешевше</Badge> : null}
      </div>

      <div className="mt-2 flex items-baseline gap-3">
        <span className="text-xl font-bold tracking-tight text-gray-900">
          {clockTime(offer.departAt)}
        </span>
        <span className="text-gray-300">→</span>
        <span className="text-xl font-bold tracking-tight text-gray-900">
          {clockTime(offer.arriveAt)}
        </span>
        {nextDayMark(offer.departAt, offer.arriveAt) ? (
          <span className="text-xs font-semibold text-gray-500">
            {nextDayMark(offer.departAt, offer.arriveAt)}
          </span>
        ) : null}
        <span className="ml-auto text-base font-semibold text-gray-900">
          {hryvnia(offer.priceKop)}
        </span>
      </div>

      <div className="mt-1 text-xs text-gray-500">
        {duration(offer.durationMin)} у дорозі · {offer.className} · вільних {offer.freeSeats}
        {offer.distanceKm ? ` · ${offer.distanceKm} км` : ''}
      </div>

      {offer.segments && offer.segments.length > 1 ? <Segments segments={offer.segments} /> : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge tone={detour ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'}>
          {KIND_LABEL[offer.kind] ?? offer.kind}
        </Badge>
        {detour ? (
          <span className="flex items-center gap-1 text-[11px] leading-snug text-gray-500">
            <DetourIcon className="h-3.5 w-3.5 text-amber-500" /> {offer.why}
          </span>
        ) : null}
        {onWatch ? (
          <button
            type="button"
            onClick={() => onWatch(offer)}
            className="ml-auto rounded-lg px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
          >
            Стежити за цим
          </button>
        ) : null}
      </div>
    </div>
  );
}
