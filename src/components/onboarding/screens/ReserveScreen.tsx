import { JobCard } from '@/components/JobCard';
import { HoldIcon } from '@/components/icons';
import { demoReservedJob } from '../mockData';
import { noop } from './parts';

export function ReserveScreen() {
  return (
    <div className="space-y-3">
      <JobCard job={demoReservedJob()} onControl={noop} />
      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-snug text-amber-800">
        <HoldIcon className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Місця тримаються ~15 хвилин. Натисніть «Кошик», завершіть оплату на booking.uz — reCAPTCHA
          проходите ви.
        </span>
      </div>
    </div>
  );
}
