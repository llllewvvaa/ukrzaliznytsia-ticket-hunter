import { EmptyState } from '@/components/EmptyState';
import { noop } from './parts';

export function DoneScreen() {
  return (
    <div className="flex h-full items-center justify-center">
      <EmptyState onNew={noop} />
    </div>
  );
}
