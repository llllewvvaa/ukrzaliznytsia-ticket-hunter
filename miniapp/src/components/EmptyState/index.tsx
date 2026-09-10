import type { ReactNode } from 'react';
import { Button } from '../ui';
import { AddIcon } from '../icons';

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
        {icon}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-gray-800">{title}</p>
        <p className="text-xs leading-relaxed text-gray-500">{description}</p>
      </div>
      {actionLabel && onAction ? (
        <Button variant="primary" onClick={onAction}>
          <AddIcon className="h-4 w-4" /> {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
