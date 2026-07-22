import { Button } from '@/components/ui';
import { AddIcon, TicketIcon } from '@/components/icons';

export function EmptyState({ onNew, onHelp }: { onNew: () => void; onHelp?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
        <TicketIcon className="h-6 w-6 text-blue-600" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-gray-800">Пошуків ще немає</p>
        <p className="text-xs leading-relaxed text-gray-500">
          Створіть пошук — і розширення саме стежитиме за квитками та зарезервує перший відповідний.
        </p>
      </div>
      <Button variant="primary" onClick={onNew}>
        <AddIcon className="h-4 w-4" /> Створити пошук
      </Button>
      {onHelp ? (
        <Button variant="ghost" size="sm" onClick={onHelp}>
          Як це працює?
        </Button>
      ) : null}
    </div>
  );
}
