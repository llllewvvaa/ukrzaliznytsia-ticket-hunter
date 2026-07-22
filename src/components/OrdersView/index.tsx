import { Accordion, Button } from '@/components/ui';
import { BackIcon, ForwardIcon } from '@/components/icons';
import { SkeletonOrderCards } from '@/components/Skeleton';
import { BOOKING_URL } from '@/lib/format/job-format';
import { useOrders } from '@/hooks/use-orders';
import { OrderCard } from './OrderCard';

export function OrdersView() {
  const { active, archived, page, totalPages, state, loadArchived } = useOrders();

  const handlePrevPage = (): void => void loadArchived(page - 1);
  const handleNextPage = (): void => void loadArchived(page + 1);

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
            <Button size="sm" disabled={page <= 1} onClick={handlePrevPage}>
              <BackIcon className="h-4 w-4" /> Новіші
            </Button>
            <span className="text-xs text-gray-500">
              {page} / {totalPages}
            </span>
            <Button size="sm" disabled={page >= totalPages} onClick={handleNextPage}>
              Старіші <ForwardIcon className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </Accordion>
    </div>
  );
}
