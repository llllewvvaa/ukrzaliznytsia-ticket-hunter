import { Badge, Button } from '../ui';
import { BackIcon, DetourIcon, TrainIcon } from '../icons';
import { OfferCard } from '../OfferCard';
import { EmptyState } from '../EmptyState';
import { SkeletonCards } from '../Skeleton';
import { useWatchOptions } from '../../hooks/use-watch-options';
import { clockTime, dateRange, duration, hryvnia, nextDayMark, relTime, shortDate } from '../../lib/format';
import { Segments } from '../Segments';
import { routeEnds, pathText, sectionsFor, type TrainGroup } from '../../lib/path-text';
import { className, type Watch } from '../../types';

function weekday(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('uk-UA', { weekday: 'long', timeZone: 'Europe/Kyiv' });
}

function TrainCard({ group, origin, destination }: { group: TrainGroup; origin: string; destination: string }) {
  const { best } = group;
  const alternatives = group.options.slice(1, 5);
  const hidden = group.options.length - 1 - alternatives.length;
  const transfer = best.segments != null && best.segments.length > 1;
  const nextDay = nextDayMark(best.journeyDepartAt, best.journeyArriveAt);

  return (
    <div
      className={`rounded-xl border bg-white p-3.5 shadow-sm ${group.isNew ? 'border-emerald-400 ring-1 ring-emerald-400/30' : 'border-gray-200'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
          <TrainIcon className="h-4 w-4 text-gray-400" />
          {group.trainNumber}
        </div>
        <div className="flex items-center gap-1.5">
          {group.isNew ? <Badge tone="bg-emerald-50 text-emerald-700">нове</Badge> : null}
          {transfer ? <Badge tone="bg-violet-50 text-violet-700">з пересадкою</Badge> : null}
          <span className="text-sm font-semibold text-gray-900">від {hryvnia(best.priceKop)}</span>
        </div>
      </div>

      {best.journeyDepartAt ? (
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-lg font-bold tracking-tight text-gray-900">{clockTime(best.journeyDepartAt)}</span>
          <span className="text-gray-300">→</span>
          <span className="text-lg font-bold tracking-tight text-gray-900">{clockTime(best.journeyArriveAt)}</span>
          {nextDay ? <span className="text-xs font-semibold text-gray-500">{nextDay}</span> : null}
          {best.durationMin > 0 ? (
            <span className="ml-auto text-xs font-medium text-gray-600">{duration(best.durationMin)} у дорозі</span>
          ) : null}
        </div>
      ) : null}

      <div className="mt-1 text-xs text-gray-600">
        {best.boardName} → {best.alightName} · {className(best.classId)} · вільних {best.freeSeats}
      </div>

      {transfer ? <Segments segments={best.segments!} /> : null}

      {best.kind === 'board_earlier' || best.kind === 'ride_further' ? (
        <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50/70 px-2.5 py-1.5 text-[11px] leading-snug text-amber-800">
          <DetourIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" /> {pathText(best, origin, destination)}
        </div>
      ) : null}

      {alternatives.length > 0 ? (
        <div className="mt-2 space-y-1 border-t border-gray-100 pt-2">
          {alternatives.map((option) => (
            <div
              key={`${option.classId}-${option.fromId}-${option.toId}`}
              className="flex items-start justify-between gap-3 text-[11px] leading-snug text-gray-500"
            >
              <span>
                {className(option.classId)} ×{option.freeSeats}
                {option.kind === 'board_earlier' || option.kind === 'ride_further' ? ` · ${pathText(option, origin, destination)}` : ''}
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
