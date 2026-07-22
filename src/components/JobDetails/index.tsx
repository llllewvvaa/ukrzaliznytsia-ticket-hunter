import { Badge, Button } from '@/components/ui';
import { BackIcon, CartIcon, TicketIcon, WarnIcon } from '@/components/icons';
import { SeatPickerModal } from '../SeatPickerModal';
import { useLogs } from '@/hooks/use-store';
import { openCheckout } from '@/lib/ui/checkout';
import { useJobRestart } from '@/hooks/use-job-restart';
import { SEAT_PREF_LABELS, activeSeatPrefKeys } from '@/lib/format/seat-prefs';
import type { SeatPrefKey } from '@/lib/format/seat-prefs';
import {
  clockTime,
  friendlyError,
  modeLabel,
  relTime,
  scheduledLabel,
  stateLabel,
  stateTone,
} from '@/lib/format/job-format';
import type { HuntJob } from '@/lib/models';

export function JobDetails({ job, onBack }: { job: HuntJob; onBack: () => void }) {
  const logs = useLogs(job.id, 50);
  const showCart = job.state === 'reserving' || job.state === 'reserved';
  const {
    submitting,
    resolving,
    resolveError,
    pickerOpen,
    setPickerOpen,
    pickerMatch,
    applyRelax,
    openManual,
    applyManual,
  } = useJobRestart(job);

  const isNoSeats = job.lastError?.startsWith('no_seats') ?? false;
  const isManualGone = job.lastError?.startsWith('manual_seats_gone') ?? false;
  const showSeatHelp = isNoSeats || isManualGone;
  const relaxKeys = activeSeatPrefKeys(job.seatPrefs);

  const handleRelaxClick = (key: SeatPrefKey) => (): void => applyRelax(key);
  const handleOpenCheckout = (): void => openCheckout(job.cartId, job.paymentUrl);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="min-w-0 truncate text-base font-semibold text-gray-900">{job.name}</h2>
        <Badge tone={stateTone(job.state)}>{stateLabel(job)}</Badge>
      </div>

      {submitting ? (
        <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs font-medium text-blue-800">
          <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" />
          {submitting}
        </div>
      ) : null}

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-gray-200 bg-white p-4 text-sm">
        <Row label="Маршрут" value={`${job.from.name} → ${job.to.name}`} />
        <Row label="Дата" value={job.date} />
        <Row label="Режим" value={modeLabel(job.mode)} />
        {job.mode === 'scheduled' && job.startAt ? (
          <Row label="Старт продажу" value={scheduledLabel(job.startAt)} />
        ) : null}
        <Row label="Спроб" value={String(job.attempts)} />
        <Row label="Поїзди" value={job.preferredTrains.join(', ') || 'будь-який'} />
        <Row label="Вагони" value={job.coachTypes.join(', ') || 'будь-який'} />
        <Row label="Пасажири" value={job.passengerIds.join(', ')} />
        <Row label="Постіль" value={job.bedding ? 'так' : 'ні'} />
        <Row label="Остання спроба" value={relTime(job.lastAttemptAt)} />
        {job.cartId != null ? <Row label="Cart" value={String(job.cartId)} /> : null}
        {job.reservedUntil ? (
          <Row label="Заброньовано до" value={clockTime(job.reservedUntil)} />
        ) : null}
        {job.lastError ? <Row label="Помилка" value={friendlyError(job.lastError)} /> : null}
      </dl>

      {showSeatHelp ? (
        <div className="space-y-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-start gap-2">
            <WarnIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-xs leading-snug text-amber-800">
              {isManualGone
                ? 'Обрані місця вже зайняли. Оберіть інші вручну.'
                : 'Немає вільних місць за вашими умовами. Послабте умову або оберіть місця вручну.'}
            </p>
          </div>

          {relaxKeys.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium text-amber-800">Повторити без:</span>
              {relaxKeys.map((k) => (
                <button
                  key={k}
                  type="button"
                  disabled={submitting != null}
                  onClick={handleRelaxClick(k)}
                  className="rounded-full border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {SEAT_PREF_LABELS[k]}
                </button>
              ))}
            </div>
          ) : null}

          <Button
            variant="primary"
            size="sm"
            disabled={resolving || submitting != null}
            onClick={openManual}
          >
            <TicketIcon className="h-4 w-4" />
            {resolving ? 'Завантаження…' : 'Обрати місця вручну'}
          </Button>
          {resolveError ? <p className="text-[11px] text-red-600">{resolveError}</p> : null}
        </div>
      ) : null}

      {showCart ? (
        <button
          type="button"
          onClick={handleOpenCheckout}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-100"
        >
          <CartIcon className="h-4 w-4" /> Відкрити кошик
        </button>
      ) : null}

      <div>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">
          Журнал (останні 50)
        </h3>
        {logs.length === 0 ? (
          <p className="text-xs text-gray-400">Записів ще немає.</p>
        ) : (
          <div className="max-h-72 overflow-y-auto rounded-xl border border-gray-200">
            <table className="w-full text-xs">
              <tbody>
                {logs.map((l, i) => (
                  <tr key={`${l.ts}-${i}`} className="border-b last:border-0">
                    <td className="whitespace-nowrap px-3 py-1.5 text-gray-400">
                      {new Date(l.ts).toLocaleTimeString()}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-gray-600">{l.endpoint}</td>
                    <td className="px-3 py-1.5 text-gray-800">{l.outcome}</td>
                    <td className="px-3 py-1.5 text-gray-500">{friendlyError(l.detail)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Button onClick={onBack}>
        <BackIcon className="h-4 w-4" /> Назад
      </Button>

      {pickerMatch ? (
        <SeatPickerModal
          open={pickerOpen}
          match={pickerMatch}
          count={Math.max(1, job.passengerIds.length)}
          onClose={() => setPickerOpen(false)}
          onConfirm={applyManual}
        />
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-gray-400">{label}</dt>
      <dd className="break-words text-gray-800">{value}</dd>
    </div>
  );
}
