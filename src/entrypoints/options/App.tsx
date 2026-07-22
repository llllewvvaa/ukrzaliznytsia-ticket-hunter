import { Button } from '@/components/ui';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useJobs } from '@/hooks/use-store';
import { useAppNavigation } from '@/hooks/use-app-navigation';
import { AuthIndicator } from '@/components/AuthIndicator';
import { AddIcon, BackIcon, TicketIcon } from '@/components/icons';
import { NewJobForm } from '@/components/NewJobForm';
import { JobDetails } from '@/components/JobDetails';
import { DebugPanel } from '@/components/DebugPanel';
import { ListView } from './ListView';

export default function App() {
  const { jobs, loading } = useJobs();
  const {
    view,
    showList,
    showNew,
    showDetail,
    submitNew,
    confirmAction,
    confirmCopy,
    requestControl,
    confirmPending,
    cancelPending,
  } = useAppNavigation();

  const detailJob = view.kind === 'detail' ? jobs.find((j) => j.id === view.jobId) : undefined;

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
              <Button variant="primary" onClick={showNew}>
                <AddIcon className="h-4 w-4" /> Новий пошук
              </Button>
            ) : (
              <Button onClick={showList}>
                <BackIcon className="h-4 w-4" /> До списку
              </Button>
            )}
          </div>
        </header>

        {view.kind === 'new' ? (
          <NewJobForm onSubmit={submitNew} onCancel={showList} />
        ) : view.kind === 'detail' && detailJob ? (
          <JobDetails job={detailJob} onBack={showList} />
        ) : (
          <ListView
            jobs={jobs}
            loading={loading}
            onControl={requestControl}
            onDetails={showDetail}
            onNew={showNew}
          />
        )}

        {view.kind === 'list' ? (
          <div className="mt-8">
            <DebugPanel />
          </div>
        ) : null}

        <footer className="mt-8 border-t border-gray-200 pt-3 text-xs leading-relaxed text-gray-400">
          Лише для особистого використання. Розширення не виконує оплату — завершуйте її вручну у
          вкладці booking.uz.
        </footer>
      </div>

      <ConfirmDialog
        open={confirmAction !== null}
        title={confirmCopy?.title ?? ''}
        message={confirmCopy?.message}
        confirmLabel={confirmCopy?.confirmLabel}
        cancelLabel={confirmCopy?.cancelLabel}
        tone="danger"
        onConfirm={confirmPending}
        onCancel={cancelPending}
      />
    </div>
  );
}
