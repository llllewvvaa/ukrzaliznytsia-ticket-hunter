import { useCallback, useState } from 'react';
import { saveJob } from './store';
import { controlConfirmCopy } from './job-format';
import { sendControl, type ControlAction } from './messages';
import type { HuntJob } from './models';

// Shared list/new/detail navigation used by the popup shell and options page.
export type JobView =
  | { kind: 'list' }
  | { kind: 'new' }
  | { kind: 'detail'; jobId: string };

type PendingConfirm = { action: 'delete' | 'cancel'; job: HuntJob };

// Job control shared by every surface: destructive actions gate on a confirm
// dialog, the rest dispatch straight to the SW.
export function useJobControl() {
  const [confirmAction, setConfirmAction] = useState<PendingConfirm | null>(null);

  const requestControl = useCallback((action: ControlAction, job: HuntJob): void => {
    if (action === 'delete' || action === 'cancel') {
      setConfirmAction({ action, job });
      return;
    }
    void sendControl(action, job.id);
  }, []);

  const confirmPending = useCallback((): void => {
    if (!confirmAction) return;
    void sendControl(confirmAction.action, confirmAction.job.id);
    setConfirmAction(null);
  }, [confirmAction]);

  const cancelPending = useCallback((): void => setConfirmAction(null), []);

  const createAndStart = useCallback(
    async (job: HuntJob, onDone?: () => void): Promise<void> => {
      await saveJob(job);
      await sendControl('start', job.id);
      onDone?.();
    },
    [],
  );

  const confirmCopy = confirmAction
    ? controlConfirmCopy(confirmAction.action, confirmAction.job.name)
    : null;

  return {
    confirmAction,
    confirmCopy,
    requestControl,
    confirmPending,
    cancelPending,
    createAndStart,
  };
}
