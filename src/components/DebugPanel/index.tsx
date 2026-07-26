import { Button, Section, Toggle } from '@/components/ui';
import { useDebugLog } from '@/hooks/use-debug-log';

export function DebugPanel() {
  const { on, count, busy, refresh, toggle, exportLog, clear } = useDebugLog();

  const handleToggleChange = (v: boolean): void => void toggle(v);
  const handleRefresh = (): void => void refresh();
  const handleExport = (): void => void exportLog();
  const handleClear = (): void => void clear();

  return (
    <Section title="Дебаг">
      <Toggle
        checked={on}
        onChange={handleToggleChange}
        label="Запис усіх запитів і подій"
        hint="Записує запити розширення + запити та навігацію booking.uz для діагностики"
      />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-500">
          Подій: <span className="font-medium text-gray-700">{count ?? '…'}</span>
        </span>
        <Button size="sm" onClick={handleRefresh}>
          Оновити
        </Button>
        <Button size="sm" variant="primary" disabled={busy || !count} onClick={handleExport}>
          Експортувати JSON
        </Button>
        <Button size="sm" variant="danger" disabled={busy || !count} onClick={handleClear}>
          Очистити
        </Button>
      </div>
      <p className="rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
        Увімкніть запис, відтворіть проблему (напр. бронювання й відкриття кошика), потім
        експортуйте файл і прикріпіть до issue. Особисті дані — токени, session-id, id користувача,
        імена, email, телефон, дані картки — приховуються автоматично. Файл безпечно надсилати, але
        про всяк випадок перегляньте його перед публікацією.
      </p>
    </Section>
  );
}
