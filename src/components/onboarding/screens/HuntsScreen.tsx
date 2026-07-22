import { Button } from '@/components/ui';
import { JobCard } from '@/components/JobCard';
import { AddIcon } from '@/components/icons';
import { demoJobs } from '../mockData';
import { noop } from './parts';

export function HuntsScreen() {
  return (
    <div className="flex flex-col gap-3">
      <Button variant="primary" size="lg" className="w-full">
        <AddIcon className="h-5 w-5" /> Створити пошук
      </Button>
      <span className="px-1 text-xs text-gray-500">2 пошуки</span>
      <div className="space-y-3">
        {demoJobs().map((j) => (
          <JobCard key={j.id} job={j} onControl={noop} />
        ))}
      </div>
    </div>
  );
}
