import { useState } from 'react';
import { Button } from '@/components/ui';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useJobs } from '@/lib/use-store';
import { saveJob } from '@/lib/store';
import { controlConfirmCopy } from '@/lib/job-format';
import { sendControl, type ControlAction } from '@/lib/messages';
import type { HuntJob } from '@/lib/models';
import { AuthIndicator } from '@/components/AuthIndicator';
import { AddIcon, BackIcon, TicketIcon } from '@/components/icons';
import { SkeletonCard } from '@/components/Skeleton';
import { JobCard } from '@/components/JobCard';
import { NewJobForm } from '@/components/NewJobForm';
import { JobDetails } from '@/components/JobDetails';
import { DebugPanel } from '@/components/DebugPanel';

type View = { kind: 'list' } | { kind: 'new' } | { kind: 'detail'; jobId: string };

export default function App() {
  const { jobs, loading } = useJobs();
  const [view, setView] = useState<View>({ kind: 'list' });
  const [confirmAction, setConfirmAction] = useState<{
    action: 'delete' | 'cancel';
    job: HuntJob;
  } | null>(null);

  const handleControl = (action: ControlAction, job: HuntJob): void => {
    if (action === 'delete' || action === 'cancel') {
      setConfirmAction({ action, job });
      return;
    }
    void sendControl(action, job.id);
  };

  const runConfirm = (): void => {
    if (!confirmAction) return;
    void sendControl(confirmAction.action, confirmAction.job.id);
    setConfirmAction(null);
  };

  const confirmCopy = confirmAction
    ? controlConfirmCopy(confirmAction.action, confirmAction.job.name)
    : null;

  const createAndStart = async (job: HuntJob): Promise<void> => {
    await saveJob(job);
    await sendControl('start', job.id);
    setView({ kind: 'list' });
  };

  const detailJob =
    view.kind === 'detail' ? jobs.find((j) => j.id === view.jobId) : undefined;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-3xl p-6">
        <header className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <TicketIcon className="h-7 w-7 text-blue-600" />
            <h1 className="text-xl font-bold">UZ Ticket Hunter</h1>
          </div>
          <div className="flex items-center gap-3">
            <AuthIndicator />
            {view.kind === 'list' ? (
              <Button variant="primary" onClick={() => setView({ kind: 'new' })}>
                <AddIcon className="h-4 w-4" /> Новий пошук
              </Button>
            ) : (
              <Button onClick={() => setView({ kind: 'list' })}>
                <BackIcon className="h-4 w-4" /> До списку
              </Button>
            )}
          </div>
        </header>

        {view.kind === 'new' ? (
          <NewJobForm
            onSubmit={(job) => void createAndStart(job)}
            onCancel={() => setView({ kind: 'list' })}
          />
        ) : view.kind === 'detail' && detailJob ? (
          <JobDetails job={detailJob} onBack={() => setView({ kind: 'list' })} />
        ) : (
          <ListView
            jobs={jobs}
            loading={loading}
            onControl={handleControl}
            onDetails={(job) => setView({ kind: 'detail', jobId: job.id })}
            onNew={() => setView({ kind: 'new' })}
          />
        )}

        {view.kind === 'list' ? (
          <div className="mt-8">
            <DebugPanel />
          </div>
        ) : null}

        <footer className="mt-8 border-t border-gray-200 pt-3 text-xs leading-relaxed text-gray-400">
          Лише для особистого використання. Розширення не виконує оплату — завершуйте її
          вручну у вкладці booking.uz.
        </footer>
      </div>

      <ConfirmDialog
        open={confirmAction !== null}
        title={confirmCopy?.title ?? ''}
        message={confirmCopy?.message}
        confirmLabel={confirmCopy?.confirmLabel}
        cancelLabel={confirmCopy?.cancelLabel}
        tone="danger"
        onConfirm={runConfirm}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}

function ListView({
  jobs,
  loading,
  onControl,
  onDetails,
  onNew,
}: {
  jobs: HuntJob[];
  loading: boolean;
  onControl: (action: ControlAction, job: HuntJob) => void;
  onDetails: (job: HuntJob) => void;
  onNew: () => void;
}) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }
  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-gray-200 bg-white py-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
          <TicketIcon className="h-7 w-7 text-blue-600" />
        </div>
        <p className="text-sm font-semibold text-gray-800">Пошуків ще немає</p>
        <p className="max-w-sm text-xs leading-relaxed text-gray-500">
          Створіть пошук — і розширення саме стежитиме за квитками та зарезервує
          перший відповідний варіант.
        </p>
        <Button variant="primary" onClick={onNew}>
          <AddIcon className="h-4 w-4" /> Створити перше
        </Button>
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} onControl={onControl} onDetails={onDetails} />
      ))}
    </div>
  );
}
