import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { openKeepAlive } from '@/lib/bridge';
import { moveSegment } from '@/lib/anim';
import { useJobs } from '@/lib/use-store';
import { saveJob } from '@/lib/store';
import { controlConfirmCopy } from '@/lib/job-format';
import { sendControl, type ControlAction } from '@/lib/messages';
import { openSidePanel, sidePanelSupported } from '@/lib/sidepanel';
import { openOnboarding } from '@/lib/onboarding';
import type { HuntJob } from '@/lib/models';
import { AuthIndicator } from '@/components/AuthIndicator';
import {
  AddIcon,
  BackIcon,
  HuntIcon,
  OrdersIcon,
  SettingsIcon,
  SidebarIcon,
  TicketIcon,
} from '@/components/icons';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonCards } from '@/components/Skeleton';
import { JobCard } from '@/components/JobCard';
import { NewJobForm } from '@/components/NewJobForm';
import { JobDetails } from '@/components/JobDetails';
import { OrdersView } from '@/components/OrdersView';
import { SettingsView } from '@/components/SettingsView';

type View = { kind: 'list' } | { kind: 'new' } | { kind: 'detail'; jobId: string };
type Tab = 'hunts' | 'orders' | 'settings';

export function AppShell({ surface }: { surface: 'popup' | 'sidepanel' }) {
  const { jobs, loading } = useJobs();
  const [tab, setTab] = useState<Tab>('hunts');
  const [view, setView] = useState<View>({ kind: 'list' });
  const [confirmAction, setConfirmAction] = useState<{
    action: 'delete' | 'cancel';
    job: HuntJob;
  } | null>(null);
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

  const moveToSidePanel = (): void => {
    void openSidePanel().then((ok) => {
      if (ok) window.close();
    });
  };

  const detailJob =
    view.kind === 'detail' ? jobs.find((j) => j.id === view.jobId) : undefined;

  const rootClasses = `flex flex-col bg-gradient-to-b from-blue-50 via-indigo-50/70 to-indigo-100/50 text-sm text-gray-900 ${
    surface === 'popup' ? 'h-[600px] w-[400px]' : 'h-screen w-full'
  }`;

  if (isWizard) {
    return (
      <div className={rootClasses}>
        <NewJobForm
          onSubmit={(job) => void createAndStart(job)}
          onCancel={() => setView({ kind: 'list' })}
        />
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
                onClick={() => setView({ kind: 'list' })}
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
          <JobDetails job={detailJob} onBack={() => setView({ kind: 'list' })} />
        ) : loading ? (
          <SkeletonCards count={4} />
        ) : jobs.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              onNew={() => setView({ kind: 'new' })}
              onHelp={() => void openOnboarding()}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={() => setView({ kind: 'new' })}
            >
              <AddIcon className="h-5 w-5" /> Створити пошук
            </Button>
            <span className="px-1 text-xs text-gray-500">
              {jobs.length} {pluralHunts(jobs.length)}
            </span>
            <div className="space-y-3">
              {jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onControl={handleControl}
                  onDetails={(j) => setView({ kind: 'detail', jobId: j.id })}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {showChrome ? (
        <footer className="border-t border-indigo-100/60 px-4 py-2 text-center text-[11px] text-gray-500">
          Лише для особистого використання. Оплату завершуйте вручну.
        </footer>
      ) : null}

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

const SEG_TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'hunts', label: 'Пошук', icon: <HuntIcon className="h-4 w-4" /> },
  { id: 'orders', label: 'Квитки', icon: <OrdersIcon className="h-4 w-4" /> },
  { id: 'settings', label: 'Налашт.', icon: <SettingsIcon className="h-4 w-4" /> },
];

function SegTabs({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const indicatorRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});
  const inited = useRef(false);

  useLayoutEffect(() => {
    const el = indicatorRef.current;
    const btn = btnRefs.current[tab];
    if (!el || !btn) return;
    moveSegment(el, btn, !inited.current);
    inited.current = true;
  }, [tab]);

  return (
    <div className="relative mt-3 flex gap-1 rounded-2xl bg-white/60 p-1 shadow-sm ring-1 ring-black/5">
      <div
        ref={indicatorRef}
        className="pointer-events-none absolute inset-y-1 left-0 w-0 rounded-xl bg-blue-600 shadow-sm"
        aria-hidden
      />
      {SEG_TABS.map((t) => (
        <button
          key={t.id}
          ref={(el) => {
            btnRefs.current[t.id] = el;
          }}
          type="button"
          onClick={() => onChange(t.id)}
          className={`relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold transition-colors duration-200 ${
            tab === t.id ? 'text-white' : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}

function pluralHunts(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'пошук';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'пошуки';
  return 'пошуків';
}
