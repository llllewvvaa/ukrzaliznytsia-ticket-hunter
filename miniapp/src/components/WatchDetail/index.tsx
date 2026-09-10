import { Badge, Button } from '../ui';
import { BackIcon, DetourIcon, TrainIcon } from '../icons';
import { OfferCard } from '../OfferCard';
import { EmptyState } from '../EmptyState';
import { SkeletonCards } from '../Skeleton';
import { useWatchOptions } from '../../hooks/use-watch-options';
import { clockTime, dateRange, hryvnia, relTime, shortDate } from '../../lib/format';
import { className, type Watch, type WatchOption } from '../../types';

function weekday(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('uk-UA', { weekday: 'long', timeZone: 'Europe/Kyiv' });
}

function groupByDate(options: WatchOption[]): { date: string; items: WatchOption[] }[] {
  const groups = new Map<string, WatchOption[]>();
  for (const option of options) groups.set(option.date, [...(groups.get(option.date) ?? []), option]);
  return [...groups.entries()].map(([date, items]) => ({ date, items }));
}

function OptionRow({ option }: { option: WatchOption }) {
  const detour = option.kind !== 'direct' && option.kind !== 'transfers';
  return (
    <div
      className={`rounded-xl border bg-white p-3.5 shadow-sm ${option.isNew ? 'border-emerald-400 ring-1 ring-emerald-400/30' : 'border-gray-200'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          <TrainIcon className="h-4 w-4 text-gray-400" />
          {option.trainNumber}
          <span className="text-xs font-normal text-gray-500">
            · {option.departAt ? clockTime(option.departAt) : ''} · {className(option.classId)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {option.isNew ? <Badge tone="bg-emerald-50 text-emerald-700">нове</Badge> : null}
          <span className="text-sm font-semibold text-gray-900">{hryvnia(option.priceKop)}</span>
        </div>
      </div>
      <div className="mt-1 text-xs text-gray-500">
        {option.fromName} → {option.toName} · вільних {option.freeSeats}
      </div>
      {detour || option.kind === 'transfers' ? (
        <div className="mt-2 flex items-center gap-1.5 text-[11px] leading-snug text-amber-800">
          <DetourIcon className="h-3.5 w-3.5 shrink-0 text-amber-600" /> {option.why}
        </div>
      ) : null}
    </div>
  );
}

export function WatchDetail({ watch, onBack }: { watch: Watch; onBack: () => void }) {
  const { data, live, loading, refreshing, error, refresh } = useWatchOptions(watch);
  const groups = groupByDate(data?.options ?? []);
  const newCount = (data?.options ?? []).filter((option) => option.isNew).length;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            aria-label="Назад"
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
          >
            <BackIcon className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-bold text-gray-900">{watch.name}</div>
            <div className="text-xs text-gray-500">
              {dateRange(watch.dateFrom, watch.dateTo)} · перевірено {relTime(data?.checkedAt ?? null)}
            </div>
          </div>
          {newCount > 0 ? <Badge tone="bg-emerald-50 text-emerald-700">нових {newCount}</Badge> : null}
        </div>
        <Button variant="primary" className="mt-3 w-full" disabled={refreshing} onClick={() => void refresh()}>
          {refreshing ? 'Перевіряю в УЗ…' : 'Перевірити зараз'}
        </Button>
      </div>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {loading ? <SkeletonCards count={3} /> : null}

      {live ? (
        <>
          <h2 className="px-1 pt-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">
            Щойно з УЗ · {live.length}
          </h2>
          {live.length === 0 ? (
            <EmptyState
              title="Зараз квитків немає"
              description="Навіть через сусідні станції. Сторож продовжує стежити й напише, щойно щось зʼявиться."
              icon={<TrainIcon className="h-6 w-6" />}
            />
          ) : (
            live.slice(0, 20).map((offer) => (
              <OfferCard
                key={`${offer.tripId}-${offer.classId}-${offer.fromId}-${offer.toId}`}
                offer={offer}
                cheapest={offer.priceKop === live[0]?.priceKop}
              />
            ))
          )}
        </>
      ) : null}

      {!loading && !live && groups.length === 0 ? (
        <EmptyState
          title="Поки що місць немає"
          description="Сторож перевіряє цей напрямок, сусідні станції й наскрізні сегменти. Щойно зʼявиться квиток — прийде одне сповіщення."
          icon={<TrainIcon className="h-6 w-6" />}
        />
      ) : null}

      {!live
        ? groups.map((group) => (
            <section key={group.date} className="space-y-2">
              <h2 className="px-1 pt-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                {shortDate(group.date)} · {weekday(group.date)} · {group.items.length}
              </h2>
              {group.items.map((option) => (
                <OptionRow
                  key={`${option.tripId}-${option.classId}-${option.fromId}-${option.toId}`}
                  option={option}
                />
              ))}
            </section>
          ))
        : null}
    </div>
  );
}
