import { Badge, Button } from '../ui';
import { DeleteIcon, DetourIcon, HistoryIcon, PauseIcon, PlayIcon, StarIcon, StarOutlineIcon } from '../icons';
import { dateRange, hryvnia, relTime } from '../../lib/format';
import { CLASS_OPTIONS, type Watch } from '../../types';

function classesLabel(watch: Watch): string {
  if (watch.classes.length === 0) return 'будь-який клас';
  return watch.classes
    .map((id) => CLASS_OPTIONS.find((option) => option.id === id)?.title ?? id)
    .join(', ');
}

function seatsLabel(watch: Watch): string | null {
  const parts: string[] = [];
  if (watch.seatPrefs.berth === 'lower') parts.push('нижня полиця');
  if (watch.seatPrefs.berth === 'upper') parts.push('верхня полиця');
  if (watch.seatPrefs.minSeats && watch.seatPrefs.minSeats > 1) parts.push(`місць ${watch.seatPrefs.minSeats}`);
  if (watch.seatPrefs.adjacent) parts.push('поруч');
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function WatchCard({
  watch,
  busy,
  onToggleFavorite,
  onTogglePause,
  onRemove,
  onHistory,
}: {
  watch: Watch;
  busy: boolean;
  onToggleFavorite: (watch: Watch) => void;
  onTogglePause: (watch: Watch) => void;
  onRemove: (watch: Watch) => void;
  onHistory: (watch: Watch) => void;
}) {
  const paused = watch.state !== 'active';
  const seats = seatsLabel(watch);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow duration-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-gray-900">{watch.name}</div>
          <div className="mt-0.5 text-xs text-gray-500">
            {dateRange(watch.dateFrom, watch.dateTo)} · {classesLabel(watch)}
          </div>
        </div>
        <Badge tone={paused ? 'bg-gray-100 text-gray-600' : 'bg-blue-50 text-blue-700'}>
          {paused ? 'пауза' : 'стежу'}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
        {watch.maxPriceKop ? <span>до {hryvnia(watch.maxPriceKop)}</span> : <span>без стелі ціни</span>}
        {seats ? <span>{seats}</span> : null}
        <span>оновлено {relTime(watch.updatedAt)}</span>
      </div>

      {watch.routes.length > 0 ? (
        <div className="mt-3 space-y-1 rounded-lg bg-amber-50/60 p-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700">
            <DetourIcon className="h-3.5 w-3.5" /> обхідні шляхи, що вже спрацьовували
          </div>
          {watch.routes.slice(0, 3).map((route) => (
            <div key={route.routeKey} className="text-[11px] leading-snug text-amber-800/90">
              {String(route.route.why ?? route.routeKey)} · {route.hits} раз(и)
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={() => onToggleFavorite(watch)}>
          {watch.favorite ? (
            <StarIcon className="h-4 w-4 text-amber-500" />
          ) : (
            <StarOutlineIcon className="h-4 w-4" />
          )}
          {watch.favorite ? 'В улюблених' : 'В улюблені'}
        </Button>
        <Button size="sm" disabled={busy} onClick={() => onTogglePause(watch)}>
          {paused ? <PlayIcon className="h-4 w-4" /> : <PauseIcon className="h-4 w-4" />}
          {paused ? 'Продовжити' : 'Пауза'}
        </Button>
        <Button size="sm" disabled={busy} onClick={() => onHistory(watch)}>
          <HistoryIcon className="h-4 w-4" /> Історія
        </Button>
        <Button size="sm" variant="danger" disabled={busy} onClick={() => onRemove(watch)}>
          <DeleteIcon className="h-4 w-4" /> Видалити
        </Button>
      </div>
    </div>
  );
}
