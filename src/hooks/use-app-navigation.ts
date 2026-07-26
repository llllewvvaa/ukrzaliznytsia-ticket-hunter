import { useState } from 'react';
import { useJobControl, type JobView } from './use-job-control';
import type { HuntJob } from '@/lib/models';

// List/new/detail navigation shared by the popup shell and the options page:
// both keep the same view state and wrap job creation with a navigate-back.
export function useAppNavigation() {
  const jobControl = useJobControl();
  const [view, setView] = useState<JobView>({ kind: 'list' });

  const showList = (): void => setView({ kind: 'list' });
  const showNew = (): void => setView({ kind: 'new' });
  const showDetail = (job: HuntJob): void => setView({ kind: 'detail', jobId: job.id });

  const submitNew = (job: HuntJob): void => {
    void jobControl.createAndStart(job, showList);
  };

  return { ...jobControl, view, showList, showNew, showDetail, submitNew };
}
