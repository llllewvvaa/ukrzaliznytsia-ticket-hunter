import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Accordion, Badge, Button } from '@/components/ui';
import { BackIcon, ForwardIcon, PdfIcon, TrainIcon } from '@/components/icons';
import { SkeletonOrderCards } from '@/components/Skeleton';
import { BOOKING_URL } from '@/lib/job-format';
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
} from '@/lib/order-format';
import { query } from '@/lib/messages';
import type {
  ActiveOrdersResponse,
  ArchivedOrdersResponse,
  UserOrder,
} from '@/lib/models';

type LoadState = 'loading' | 'ok' | 'auth' | 'error';

export function OrdersView() {
  const [active, setActive] = useState<UserOrder[]>([]);
  const [archived, setArchived] = useState<UserOrder[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [state, setState] = useState<LoadState>('loading');

  const loadArchived = useCallback(async (p: number): Promise<LoadState> => {
    const res = await query<ArchivedOrdersResponse>('archivedOrders', { page: p });
    if (!res.ok) return res.code === 'not_authenticated' ? 'auth' : 'error';
    setArchived(res.data?.orders ?? []);
    setTotalPages(res.data?.pagination.total_pages ?? 1);
    setPage(p);
    return 'ok';
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const act = await query<ActiveOrdersResponse>('activeOrders');
      if (!alive) return;
      if (!act.ok) {
        setState(act.code === 'not_authenticated' ? 'auth' : 'error');
        return;
      }
      setActive(act.data?.orders ?? []);
      const archStatus = await loadArchived(1);
      if (alive) setState(archStatus);
    })();
    return () => {
      alive = false;
    };
  }, [loadArchived]);

  if (state === 'loading') {
    return (
      <div className="flex flex-col gap-3">
        <Accordion title="Активні" defaultOpen>
          <SkeletonOrderCards count={2} />
        </Accordion>
        <Accordion title="Архів">
          <SkeletonOrderCards count={1} />
        </Accordion>
      </div>
    );
  }

  if (state === 'auth') {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-6 text-center">
          <p className="text-sm text-gray-600">
            Щоб бачити свої квитки, увійдіть на booking.uz у цьому браузері.
          </p>
          <a
            href={BOOKING_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Відкрити booking.uz
          </a>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-center text-sm text-red-500">
          Не вдалося завантажити квитки. Спробуйте пізніше.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Accordion title="Активні" count={active.length} defaultOpen>
        {active.length === 0 ? (
          <p className="text-xs text-gray-400">Немає активних квитків.</p>
        ) : (
          <div className="space-y-2">
            {active.map((o) => (
              <OrderCard key={o.id} order={o} active />
            ))}
          </div>
        )}
      </Accordion>

      <Accordion title="Архів" count={archived.length}>
        {archived.length === 0 ? (
          <p className="text-xs text-gray-400">Архів порожній.</p>
        ) : (
          <div className="space-y-2">
            {archived.map((o) => (
              <OrderCard key={o.id} order={o} />
            ))}
          </div>
        )}

        {totalPages > 1 ? (
          <div className="flex items-center justify-between pt-3">
            <Button
              size="sm"
              disabled={page <= 1}
              onClick={() => void loadArchived(page - 1)}
            >
              <BackIcon className="h-4 w-4" /> Новіші
            </Button>
            <span className="text-xs text-gray-500">
              {page} / {totalPages}
            </span>
            <Button
              size="sm"
              disabled={page >= totalPages}
              onClick={() => void loadArchived(page + 1)}
            >
              Старіші <ForwardIcon className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </Accordion>
    </div>
  );
}

function OrderCard({ order, active = false }: { order: UserOrder; active?: boolean }) {
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

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600">
      {children}
    </span>
  );
}
