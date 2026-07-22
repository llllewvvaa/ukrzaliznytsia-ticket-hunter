import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { openKeepAlive } from '@/lib/engine/bridge';
import { useJobs } from '@/hooks/use-store';
import { useAppNavigation } from '@/hooks/use-app-navigation';
import { openSidePanelAndClosePopup, sidePanelSupported } from '@/lib/ui/sidepanel';
import { openOnboarding } from '@/lib/ui/onboarding';
import { pluralHunts } from '@/lib/format/job-format';
import { AuthIndicator } from '@/components/AuthIndicator';
import { DonateButton } from '@/components/donate';
import { AddIcon, BackIcon, SidebarIcon, TicketIcon } from '@/components/icons';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonCards } from '@/components/Skeleton';
import { JobCard } from '@/components/JobCard';
import { NewJobForm } from '@/components/NewJobForm';
import { JobDetails } from '@/components/JobDetails';
import { OrdersView } from '@/components/OrdersView';
import { SettingsView } from '@/components/SettingsView';
import { SegTabs } from './SegTabs';
import type { Tab } from './types';

export function AppShell({ surface }: { surface: 'popup' | 'sidepanel' }) {
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
  const [tab, setTab] = useState<Tab>('hunts');
  // keep-alive port holds the SW awake so a scheduled sprint fires reliably
  const hasLiveJob = jobs.some(
    (j) => j.state === 'scheduled' || j.state === 'hunting' || j.state === 'reserving',
  );
  useEffect(() => {
    if (!hasLiveJob) return;
    const port = openKeepAlive();
    return () => port.disconnect();
  }, [hasLiveJob]);

  const isWizard = tab === 'hunts' && view.kind === 'new';
  const isDetail = tab === 'hunts' && view.kind === 'detail';
  const showChrome = !isWizard && !isDetail;
  const canSidePanel = surface === 'popup' && sidePanelSupported();

  const moveToSidePanel = (): void => openSidePanelAndClosePopup();

  const handleOpenOnboarding = (): void => void openOnboarding();

  const detailJob = view.kind === 'detail' ? jobs.find((j) => j.id === view.jobId) : undefined;

  const rootClasses = `flex flex-col bg-gradient-to-b from-blue-50 via-indigo-50/70 to-indigo-100/50 text-sm text-gray-900 ${
    surface === 'popup' ? 'h-[600px] w-[400px]' : 'h-screen w-full'
  }`;

  if (isWizard) {
    return (
      <div className={rootClasses}>
        <NewJobForm onSubmit={submitNew} onCancel={showList} />
      </div>
    );
  }

  return (
    <div className={rootClasses}>
      <header className="px-4 pb-3 pt-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {isDetail ? (
              <button
                type="button"
                onClick={showList}
                aria-label="Назад"
                className="grid h-7 w-7 place-items-center rounded-md text-gray-500 transition-colors hover:bg-white/70 hover:text-gray-800"
              >
                <BackIcon className="h-5 w-5" />
              </button>
            ) : (
              <TicketIcon className="h-5 w-5 shrink-0 text-blue-600" />
            )}
            <h1 className="truncate text-base font-bold text-gray-900">
              {isDetail ? 'Деталі пошуку' : 'Ticket Hunter'}
            </h1>
          </div>
          <div className="flex items-center gap-1.5">
            <AuthIndicator />
            {canSidePanel ? (
              <button
                type="button"
                onClick={moveToSidePanel}
                aria-label="Відкрити в бічній панелі"
                title="Відкрити в бічній панелі"
                className="grid h-7 w-7 place-items-center rounded-md text-gray-500 transition-colors hover:bg-white/70 hover:text-gray-800"
              >
                <SidebarIcon className="h-5 w-5" />
              </button>
            ) : null}
          </div>
        </div>

        {showChrome ? <SegTabs tab={tab} onChange={setTab} /> : null}
      </header>

      <div className="flex flex-1 flex-col overflow-y-auto p-4">
        {tab === 'orders' ? (
          <OrdersView />
        ) : tab === 'settings' ? (
          <SettingsView surface={surface} />
        ) : isDetail && detailJob ? (
          <JobDetails job={detailJob} onBack={showList} />
        ) : loading ? (
          <SkeletonCards count={4} />
        ) : jobs.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState onNew={showNew} onHelp={handleOpenOnboarding} />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Button variant="primary" size="lg" className="w-full" onClick={showNew}>
              <AddIcon className="h-5 w-5" /> Створити пошук
            </Button>
            <span className="px-1 text-xs text-gray-500">
              {jobs.length} {pluralHunts(jobs.length)}
            </span>

            <div className="space-y-3">
              {jobs.map((job) => (
                <JobCard key={job.id} job={job} onControl={requestControl} onDetails={showDetail} />
              ))}
            </div>
          </div>
        )}
      </div>

      {showChrome ? (
        <footer className="flex flex-col items-center gap-1.5 border-t border-indigo-100/60 px-4 py-2">
          <DonateButton />
          <p className="text-center text-[11px] text-gray-500">
            Лише для особистого використання. Оплату завершуйте вручну.
          </p>
        </footer>
      ) : null}

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
