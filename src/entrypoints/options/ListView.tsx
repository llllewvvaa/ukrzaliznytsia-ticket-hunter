import { SkeletonCard } from '@/components/Skeleton';
import { JobCard } from '@/components/JobCard';
import { EmptyState } from '@/components/EmptyState';
import { type ControlAction } from '@/lib/messages';
import type { HuntJob } from '@/lib/models';

export function ListView({
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
    return <EmptyState onNew={onNew} />;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} onControl={onControl} onDetails={onDetails} />
      ))}
    </div>
  );
}
