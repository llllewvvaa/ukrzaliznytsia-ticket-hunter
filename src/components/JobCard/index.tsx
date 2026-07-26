import { Badge, Button } from '@/components/ui';
import { DonateStrip } from '@/components/donate';
import {
  CartIcon,
  HoldIcon,
  PauseIcon,
  PlayIcon,
  ScheduleIcon,
  WarnIcon,
} from '@/components/icons';
import {
  canStart,
  friendlyError,
  holdExpired,
  holdUntilLabel,
  isActive,
  modeLabel,
  relTime,
  scheduledLabel,
  stateLabel,
  stateTone,
} from '@/lib/format/job-format';
import type { ControlAction } from '@/lib/messages';
import { openCheckout } from '@/lib/ui/checkout';
import { formatDate } from '@/lib/format/date';
import { useNow } from '@/hooks/use-now';
import type { HuntJob } from '@/lib/models';

export function JobCard({
  job,
  onControl,
  onDetails,
}: {
  job: HuntJob;
  onControl: (action: ControlAction, job: HuntJob) => void;
  onDetails?: (job: HuntJob) => void;
}) {
  const active = isActive(job.state);
  const showCart = job.state === 'reserving' || job.state === 'reserved';
  const now = useNow(showCart && job.reservedUntil != null);
  const holdLabel = holdUntilLabel(job.reservedUntil, now);
  const holdOver = showCart && holdExpired(job.reservedUntil, now);

  const handleControl = (action: ControlAction) => (): void => onControl(action, job);
  const handleOpenCheckout = (): void => openCheckout(job.cartId, job.paymentUrl);
  const handleDetails = (): void => onDetails?.(job);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow duration-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            <span className="truncate">{job.from.name}</span>
            <span className="shrink-0 text-gray-400">→</span>
            <span className="truncate">{job.to.name}</span>
          </div>
          <div className="mt-0.5 text-xs text-gray-500">
            {formatDate(job.date)} · {modeLabel(job.mode)}
          </div>
        </div>
        <Badge tone={stateTone(job.state)}>{stateLabel(job)}</Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
        <span>
          Спроб: <span className="font-medium text-gray-700">{job.attempts}</span>
        </span>
        <span>Остання: {relTime(job.lastAttemptAt)}</span>
        {job.lastError ? <LastErrorChip error={job.lastError} /> : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {canStart(job.state) ? (
          <Button variant="primary" size="sm" onClick={handleControl('start')}>
            <PlayIcon className="h-4 w-4" /> Старт
          </Button>
        ) : null}
        {job.state === 'paused' ? (
          <Button variant="primary" size="sm" onClick={handleControl('resume')}>
            <PlayIcon className="h-4 w-4" /> Продовжити
          </Button>
        ) : null}
        {active ? (
          <Button size="sm" onClick={handleControl('pause')}>
            <PauseIcon className="h-4 w-4" /> Пауза
          </Button>
        ) : null}
        {active ? (
          <Button size="sm" onClick={handleControl('cancel')}>
            Скасувати
          </Button>
        ) : null}
        {showCart ? (
          <button
            type="button"
            onClick={handleOpenCheckout}
            className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100"
          >
            <CartIcon className="h-4 w-4" /> Кошик
          </button>
        ) : null}
        {holdLabel ? (
          <span
            className="inline-flex items-center gap-1 rounded-lg bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700"
            title="Місця тримаються до цього часу — встигніть оплатити"
          >
            <HoldIcon className="h-4 w-4" /> {holdLabel}
            <span className="sr-only">Місця тримаються до цього часу — встигніть оплатити</span>
          </span>
        ) : holdOver ? (
          <span
            className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700"
            title="15-хвилинне утримання місць вичерпано — місця могли звільнити"
          >
            <WarnIcon className="h-4 w-4" /> Час утримання вичерпано
            <span className="sr-only">
              15-хвилинне утримання місць вичерпано — місця могли звільнити
            </span>
          </span>
        ) : null}
        {job.state === 'scheduled' && job.startAt ? (
          <span
            className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700"
            title="Коли почнеться полювання за квитками"
          >
            <ScheduleIcon className="h-4 w-4" /> Старт {scheduledLabel(job.startAt)}
            <span className="sr-only">Коли почнеться полювання за квитками</span>
          </span>
        ) : null}
        {onDetails ? (
          <Button variant="ghost" size="sm" onClick={handleDetails}>
            Деталі
          </Button>
        ) : null}
        <Button
          variant="danger"
          size="sm"
          className="ml-auto"
          onClick={handleControl('delete')}
          title="Видалити пошук"
          aria-label="Видалити пошук"
        >
          Видалити
        </Button>
      </div>

      {job.state === 'reserved' ? <DonateStrip /> : null}
    </div>
  );
}

function LastErrorChip({ error }: { error: string }) {
  const msg = friendlyError(error);
  const clipped = msg.length > 36 ? `${msg.slice(0, 36)}…` : msg;
  return (
    <span className="inline-flex items-center gap-1 text-red-500" title={msg}>
      <WarnIcon className="h-3.5 w-3.5 shrink-0" />
      <span aria-hidden="true">{clipped}</span>
      <span className="sr-only">{msg}</span>
    </span>
  );
}
