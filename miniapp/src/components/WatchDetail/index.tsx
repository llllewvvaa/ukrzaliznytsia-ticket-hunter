import { Badge, Button } from '../ui';
import { BackIcon, DetourIcon, TrainIcon } from '../icons';
import { OfferCard } from '../OfferCard';
import { EmptyState } from '../EmptyState';
import { SkeletonCards } from '../Skeleton';
import { useWatchOptions } from '../../hooks/use-watch-options';
import { clockTime, dateRange, hryvnia, relTime, shortDate } from '../../lib/format';
import { routeEnds, pathText, sectionsFor, type TrainGroup } from '../../lib/path-text';
import { className, type Watch } from '../../types';

function weekday(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('uk-UA', { weekday: 'long', timeZone: 'Europe/Kyiv' });
}

function TrainCard({ group, origin, destination }: { group: TrainGroup; origin: string; destination: string }) {
  const { best } = group;
  const alternatives = group.options.slice(1, 5);
  const hidden = group.options.length - 1 - alternatives.length;

  return (
    <div
      className={`rounded-xl border bg-white p-3.5 shadow-sm ${group.isNew ? 'border-emerald-400 ring-1 ring-emerald-400/30' : 'border-gray-200'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          <TrainIcon className="h-4 w-4 text-gray-400" />
          {group.trainNumber}
          {best.departAt ? <span className="text-xs font-normal text-gray-500">· {clockTime(best.departAt)}</span> : null}
        </div>
        <div className="flex items-center gap-1.5">
          {group.isNew ? <Badge tone="bg-emerald-50 text-emerald-700">нове</Badge> : null}
          <span className="text-sm font-semibold text-gray-900">від {hryvnia(best.priceKop)}</span>
        </div>
      </div>

      <div className="mt-1.5 text-xs text-gray-700">
        {className(best.classId)} · вільних {best.freeSeats} · {pathText(best, origin, destination)}
      </div>

      {alternatives.length > 0 ? (
        <div className="mt-2 space-y-1 border-t border-gray-100 pt-2">
          {alternatives.map((option) => (
            <div
              key={`${option.classId}-${option.fromId}-${option.toId}`}
              className="flex items-start justify-between gap-3 text-[11px] leading-snug text-gray-500"
            >
              <span className="flex items-start gap-1">
                {option.kind !== 'direct' && option.kind !== 'neighbor_date' ? (
                  <DetourIcon className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                ) : null}
                {className(option.classId)} ×{option.freeSeats} · {pathText(option, origin, destination)}
              </span>
              <span className="shrink-0 text-gray-700">{hryvnia(option.priceKop)}</span>
            </div>
          ))}
          {hidden > 0 ? <div className="text-[11px] text-gray-400">ще {hidden} варіант(и)</div> : null}
        </div>
      ) : null}
    </div>
  );
}

export function WatchDetail({ watch, onBack }: { watch: Watch; onBack: () => void }) {
  const { data, live, loading, refreshing, error, refresh } = useWatchOptions(watch);
  const sections = sectionsFor(data?.options ?? [], watch.dateFrom, watch.dateTo);
  const { origin, destination } = routeEnds(watch.name);
  const newCount = new Set((data?.options ?? []).filter((o) => o.isNew).map((o) => `${o.date}:${o.trainNumber}`)).size;
  const firstOutside = sections.findIndex((section) => !section.inWindow);

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

      {!loading && !live && sections.length === 0 ? (
        <EmptyState
          title="Поки що місць немає"
          description="Сторож перевіряє цей напрямок, сусідні станції й наскрізні сегменти. Щойно зʼявиться квиток — прийде одне сповіщення."
          icon={<TrainIcon className="h-6 w-6" />}
        />
      ) : null}

      {!live
        ? sections.map((section, index) => (
            <section key={section.date} className="space-y-2">
              {index === firstOutside ? (
                <p className="px-1 pt-3 text-[11px] leading-snug text-gray-400">
                  Поза твоїми датами, але поруч — на випадок, якщо можна зсунутись на день.
                </p>
              ) : null}
              <h2
                className={`px-1 pt-1 text-[11px] font-bold uppercase tracking-wider ${section.inWindow ? 'text-gray-500' : 'text-gray-300'}`}
              >
                {shortDate(section.date)} · {weekday(section.date)} · потягів {section.trains.length}
              </h2>
              {section.trains.map((group) => (
                <TrainCard key={group.trainNumber} group={group} origin={origin} destination={destination} />
              ))}
            </section>
          ))
        : null}
    </div>
  );
}
