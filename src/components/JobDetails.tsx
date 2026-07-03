import { useEffect, useRef, useState } from 'react';
import { Badge, Button } from '@/components/ui';
import { BackIcon, CartIcon, TicketIcon, WarnIcon } from '@/components/icons';
import { SeatPickerModal } from './SeatPickerModal';
import { useLogs } from '@/lib/use-store';
import { saveJob } from '@/lib/store';
import { query, sendControl } from '@/lib/messages';
import {
  SEAT_PREF_LABELS,
  activeSeatPrefKeys,
  relaxPrefs,
  type SeatPrefKey,
} from '@/lib/seat-prefs';
import type { MatchRef, Trip } from '@/lib/models';
import {
  clockTime,
  friendlyError,
  modeLabel,
  relTime,
  scheduledLabel,
  stateLabel,
  stateTone,
} from '@/lib/job-format';
import type { HuntJob } from '@/lib/models';

export function JobDetails({
  job,
  onBack,
}: {
  job: HuntJob;
  onBack: () => void;
}) {
  const logs = useLogs(job.id, 50);
  const showCart = job.state === 'reserving' || job.state === 'reserved';
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMatch, setPickerMatch] = useState<MatchRef | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState<string | null>(null);
  const submitBaseAttempts = useRef(job.attempts);

  useEffect(() => {
    if (!submitting) return;
    if (
      job.attempts !== submitBaseAttempts.current ||
      job.state === 'reserving' ||
      job.state === 'reserved' ||
      job.pauseReason === 'captcha'
    ) {
      setSubmitting(null);
    }
  }, [submitting, job.attempts, job.state, job.pauseReason]);

  const isNoSeats = job.lastError?.startsWith('no_seats') ?? false;
  const isManualGone = job.lastError?.startsWith('manual_seats_gone') ?? false;
  const showSeatHelp = isNoSeats || isManualGone;
  const relaxKeys = activeSeatPrefKeys(job.seatPrefs);

  const restart = (patch: Partial<HuntJob>, status: string): void => {
    submitBaseAttempts.current = job.attempts;
    setSubmitting(status);
    window.setTimeout(() => setSubmitting((s) => (s === status ? null : s)), 15_000);
    void saveJob({
      ...job,
      state: 'idle',
      pauseReason: undefined,
      pausedUntil: undefined,
      lastError: undefined,
      relaxHint: undefined,
      ...patch,
    }).then(() => sendControl('start', job.id));
  };

  const applyRelax = (key: SeatPrefKey): void => {
    restart(
      { seatPrefs: relaxPrefs(job.seatPrefs ?? {}, key), manualSeats: undefined },
      `Повторюю пошук без «${SEAT_PREF_LABELS[key]}»…`,
    );
  };

  const openManual = (): void => {
    setResolveError(undefined);
    if (job.lastMatch) {
      setPickerMatch(job.lastMatch);
      setPickerOpen(true);
      return;
    }
    setResolving(true);
    void query<Trip[]>('trips', { fromId: job.from.id, toId: job.to.id, date: job.date })
      .then((res) => {
        const match =
          res.ok && Array.isArray(res.data)
            ? resolveMatch(res.data, job.preferredTrains, job.coachTypes)
            : null;
        if (match) {
          setPickerMatch(match);
          setPickerOpen(true);
        } else {
          setResolveError('Не вдалося знайти потяг для ручного вибору. Оновіть пошук пізніше.');
        }
      })
      .finally(() => setResolving(false));
  };

  const applyManual = (pick: { wagonNumber: string; seats: number[] }): void => {
    setPickerOpen(false);
    const match = pickerMatch;
    if (!match) return;
    restart(
      {
        manualSeats: pick,
        preferredTrains: [match.trainNumber],
        coachTypes: [match.classId],
        seatPrefs: undefined,
      },
      `Бронюю місця ${pick.seats.join(', ')} у вагоні ${pick.wagonNumber}…`,
    );
  };

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
                  onClick={() => applyRelax(k)}
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
          {resolveError ? (
            <p className="text-[11px] text-red-600">{resolveError}</p>
          ) : null}
        </div>
      ) : null}

      {showCart ? (
        <button
          type="button"
          onClick={() =>
            void query('openCheckout', { cartId: job.cartId, paymentUrl: job.paymentUrl })
          }
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

function resolveMatch(
  trips: Trip[],
  preferredTrains: string[],
  coachTypes: Array<string>,
): MatchRef | null {
  const trains = preferredTrains.length
    ? trips.filter((t) => preferredTrains.includes(t.train.number))
    : trips;
  for (const trip of trains) {
    const classes = coachTypes.length
      ? trip.train.wagon_classes.filter((c) => coachTypes.includes(c.id))
      : trip.train.wagon_classes;
    const cls = classes.find((c) => c.free_seats > 0);
    if (cls) return { tripId: trip.id, trainNumber: trip.train.number, classId: String(cls.id) };
  }
  return null;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-gray-400">{label}</dt>
      <dd className="break-words text-gray-800">{value}</dd>
    </div>
  );
}
