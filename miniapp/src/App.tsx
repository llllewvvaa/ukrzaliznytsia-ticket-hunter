import { useEffect, useMemo, useState } from 'react';
import { AppShell } from './components/AppShell';
import type { Tab } from './components/AppShell/types';
import { EmptyState } from './components/EmptyState';
import { EventCard } from './components/EventCard';
import { NewWatchWizard } from './components/NewWatchWizard';
import type { WizardState } from './components/NewWatchWizard/types';
import { SkeletonCards } from './components/Skeleton';
import { StatsPanel } from './components/StatsPanel';
import { WatchCard } from './components/WatchCard';
import { WaysView } from './components/WaysView';
import { AddIcon, HistoryIcon, WatchIcon } from './components/icons';
import { Button } from './components/ui';
import { useEvents } from './hooks/use-events';
import { useStats } from './hooks/use-stats';
import { useWatches } from './hooks/use-watches';
import { api } from './lib/api';
import type { Offer, Station, Watch } from './types';

export function App() {
  const [tab, setTab] = useState<Tab>('watches');
  const [wizard, setWizard] = useState<Partial<WizardState> | null>(null);
  const [selected, setSelected] = useState<Watch | null>(null);
  const [statsKey, setStatsKey] = useState(0);
  const watches = useWatches();
  const stats = useStats(statsKey);
  const historyWatch = selected ?? watches.watches[0] ?? null;
  const { events, forecast, loading: eventsLoading } = useEvents(
    tab === 'history' ? (historyWatch?.id ?? null) : null,
  );

  useEffect(() => {
    api.ready();
  }, []);

  const favorites = useMemo(() => watches.watches.filter((watch) => watch.favorite), [watches.watches]);
  const others = useMemo(() => watches.watches.filter((watch) => !watch.favorite), [watches.watches]);

  const handleWatchOffer = (offer: Offer, from: Station, to: Station): void => {
    setWizard({
      from,
      to,
      dateFrom: offer.date,
      days: 1,
      classes: offer.classId.startsWith('MIX') ? [] : [offer.classId],
    });
    setTab('watches');
  };

  const handleWizardDone = (): void => {
    setWizard(null);
    void watches.reload();
    setStatsKey((key) => key + 1);
  };

  const handleHistory = (watch: Watch): void => {
    setSelected(watch);
    setTab('history');
  };

  const openWizard = (): void => setWizard({});

  return (
    <AppShell tab={tab} onTabChange={setTab} online={stats != null}>
      {tab === 'ways' ? <WaysView onWatchOffer={handleWatchOffer} /> : null}

      {tab === 'watches' ? (
        wizard ? (
          <NewWatchWizard initial={wizard} onDone={handleWizardDone} onCancel={() => setWizard(null)} />
        ) : (
          <>
            {watches.loading ? <SkeletonCards /> : null}

            {!watches.loading && watches.watches.length === 0 ? (
              <EmptyState
                title="Стежень ще немає"
                description="Створіть стеження — сторож сам перевірятиме напрямок, обхідні шляхи й ціни, і напише, щойно зʼявиться спосіб доїхати."
                actionLabel="Створити стеження"
                onAction={openWizard}
                icon={<WatchIcon className="h-6 w-6" />}
              />
            ) : null}

            {favorites.length > 0 ? (
              <h2 className="px-1 pt-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Улюблені
              </h2>
            ) : null}
            {favorites.map((watch) => (
              <WatchCard
                key={watch.id}
                watch={watch}
                busy={watches.loading}
                onToggleFavorite={(value) => void watches.toggleFavorite(value)}
                onTogglePause={(value) => void watches.togglePause(value)}
                onRemove={(value) => void watches.remove(value)}
                onHistory={handleHistory}
              />
            ))}

            {others.length > 0 ? (
              <h2 className="px-1 pt-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Інші стеження
              </h2>
            ) : null}
            {others.map((watch) => (
              <WatchCard
                key={watch.id}
                watch={watch}
                busy={watches.loading}
                onToggleFavorite={(value) => void watches.toggleFavorite(value)}
                onTogglePause={(value) => void watches.togglePause(value)}
                onRemove={(value) => void watches.remove(value)}
                onHistory={handleHistory}
              />
            ))}

            {watches.watches.length > 0 ? (
              <Button
                variant="ghost"
                size="lg"
                className="w-full border border-dashed border-gray-300 bg-white/60"
                onClick={openWizard}
              >
                <AddIcon className="h-4 w-4" /> Нове стеження
              </Button>
            ) : null}

            {watches.error ? <p className="text-xs text-red-600">{watches.error}</p> : null}
          </>
        )
      ) : null}

      {tab === 'history' ? (
        <>
          {watches.watches.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {watches.watches.map((watch) => (
                <button
                  key={watch.id}
                  type="button"
                  onClick={() => setSelected(watch)}
                  className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium ${
                    historyWatch?.id === watch.id
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-gray-300 bg-white text-gray-700'
                  }`}
                >
                  {watch.name}
                </button>
              ))}
            </div>
          ) : null}

          <StatsPanel stats={stats} forecast={forecast} />

          {eventsLoading ? <SkeletonCards count={2} /> : null}

          {!eventsLoading && events.length === 0 ? (
            <EmptyState
              title="Подій ще немає"
              description="Перше спостереження кожного напрямку мовчазне — це базова лінія. Далі сторож повідомляє лише про зміни."
              icon={<HistoryIcon className="h-6 w-6" />}
            />
          ) : null}

          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </>
      ) : null}
    </AppShell>
  );
}
