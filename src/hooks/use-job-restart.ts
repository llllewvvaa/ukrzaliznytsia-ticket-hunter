import { useEffect, useRef, useState } from 'react';
import { saveJob } from '@/lib/store';
import { query, sendControl } from '@/lib/messages';
import { resolveMatch } from '@/lib/format/match-trip';
import { SEAT_PREF_LABELS, relaxPrefs, type SeatPrefKey } from '@/lib/format/seat-prefs';
import type { HuntJob, MatchRef, Trip } from '@/lib/models';

// "Restart with a patch" flows for a failed/paused job: relax one seat pref or
// apply a manual seat pick, then relaunch the hunt. `submitting` holds the
// status line until the job visibly reacts (new attempt, reserving/reserved,
// captcha) or a 15s safety timeout fires — the SW gives no explicit ack.
export function useJobRestart(job: HuntJob) {
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

  return {
    submitting,
    resolving,
    resolveError,
    pickerOpen,
    setPickerOpen,
    pickerMatch,
    applyRelax,
    openManual,
    applyManual,
  };
}
