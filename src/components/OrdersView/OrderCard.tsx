import { Badge } from '@/components/ui';
import { PdfIcon, TrainIcon } from '@/components/icons';
import {
  dayLabel,
  durationLabel,
  hhmm,
  hryvnia,
  isReturned,
  orderTotal,
  overnightDays,
  passengerName,
  stationText,
} from '@/lib/format/order-format';
import type { UserOrder } from '@/lib/models';
import { Pill } from './Pill';

export function OrderCard({ order, active = false }: { order: UserOrder; active?: boolean }) {
  const tickets = order.tickets ?? [];
  const { depart_at: depart, arrive_at: arrive } = order.trip;
  const duration = durationLabel(depart, arrive);
  const plusDays = overnightDays(depart, arrive);

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm ring-1 ring-black/[0.02]">
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 px-4 pb-3.5 pt-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-bold text-blue-700 ring-1 ring-blue-100">
              <TrainIcon className="h-3.5 w-3.5" /> {order.train.number}
            </span>
            {active ? <Badge tone="bg-green-100 text-green-700">Активний</Badge> : null}
          </div>
          <span className="shrink-0 text-sm font-bold text-gray-900">
            {hryvnia(orderTotal(order))}
          </span>
        </div>

        <div className="mt-3 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-xl font-bold leading-none text-gray-900">{hhmm(depart)}</div>
            <div className="mt-1 truncate text-xs font-medium text-gray-600">
              {stationText(order.train.station_from)}
            </div>
          </div>

          <div className="flex min-w-[76px] flex-col items-center pt-0.5">
            <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
              {dayLabel(depart)}
            </span>
            <div className="mt-1 flex w-full items-center gap-1 text-blue-300">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
              <span className="h-px flex-1 bg-gradient-to-r from-blue-300 to-indigo-300" />
              <TrainIcon className="h-3.5 w-3.5 text-blue-400" />
              <span className="h-px flex-1 bg-gradient-to-r from-indigo-300 to-blue-300" />
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
            </div>
            {duration ? <span className="mt-1 text-[10px] text-gray-400">{duration}</span> : null}
          </div>

          <div className="min-w-0 flex-1 text-right">
            <div className="text-xl font-bold leading-none text-gray-900">
              {hhmm(arrive)}
              {plusDays > 0 ? (
                <sup className="ml-0.5 text-[10px] font-semibold text-blue-500">+{plusDays}</sup>
              ) : null}
            </div>
            <div className="mt-1 truncate text-xs font-medium text-gray-600">
              {stationText(order.train.station_to)}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-dashed border-gray-200" />

      <ul className="divide-y divide-gray-100 px-4">
        {tickets.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-gray-800">
                {passengerName(t.reservation)}
                {isReturned(t) ? (
                  <span className="ml-1.5 rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">
                    повернено
                  </span>
                ) : null}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <Pill>Вагон {t.reservation.wagon_number}</Pill>
                <Pill>Місце {t.reservation.seat_number}</Pill>
                {t.reservation.wagon_class_name ? (
                  <Pill>{t.reservation.wagon_class_name}</Pill>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-sm font-semibold text-gray-800">
                {hryvnia(t.reservation.price)}
              </span>
              {t.pdf_url ? (
                <a
                  href={t.pdf_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 transition-colors hover:bg-blue-100"
                >
                  <PdfIcon className="h-3.5 w-3.5" /> PDF
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
