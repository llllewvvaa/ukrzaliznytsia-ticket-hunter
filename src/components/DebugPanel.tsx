import { useCallback, useEffect, useState } from 'react';
import { Button, Section, Toggle } from '@/components/ui';
import { query } from '@/lib/messages';
import { isDebugEnabledStored, setDebugEnabled } from '@/lib/debug';
import type { DebugEvent } from '@/lib/models';

export function DebugPanel() {
  const [on, setOn] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const r = await query<number>('debugLog', { countOnly: true });
    setCount(r.ok && typeof r.data === 'number' ? r.data : 0);
  }, []);

  useEffect(() => {
    void isDebugEnabledStored().then(setOn);
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!on) return;
    const id = window.setInterval(() => void refresh(), 3000);
    return () => window.clearInterval(id);
  }, [on, refresh]);

  const toggle = async (next: boolean): Promise<void> => {
    setOn(next);
    await setDebugEnabled(next);
    void refresh();
  };

  const exportLog = async (): Promise<void> => {
    setBusy(true);
    try {
      const r = await query<DebugEvent[]>('debugLog');
      const events = r.ok && Array.isArray(r.data) ? r.data : [];
      const blob = new Blob(
        [JSON.stringify({ exportedAt: new Date().toISOString(), count: events.length, events }, null, 2)],
        { type: 'application/json' },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `uz-debug-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 5_000);
    } finally {
      setBusy(false);
    }
  };

  const clear = async (): Promise<void> => {
    setBusy(true);
    try {
      await query('debugClear');
      setCount(0);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Дебаг">
      <Toggle
        checked={on}
        onChange={(v) => void toggle(v)}
        label="Запис усіх запитів і подій"
        hint="Записує запити розширення + запити та навігацію booking.uz для діагностики"
      />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-gray-500">
          Подій: <span className="font-medium text-gray-700">{count ?? '…'}</span>
        </span>
        <Button size="sm" onClick={() => void refresh()}>
          Оновити
        </Button>
        <Button
          size="sm"
          variant="primary"
          disabled={busy || !count}
          onClick={() => void exportLog()}
        >
          Експортувати JSON
        </Button>
        <Button size="sm" variant="danger" disabled={busy || !count} onClick={() => void clear()}>
          Очистити
        </Button>
      </div>
      <p className="rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
        Увімкніть запис, відтворіть проблему (напр. бронювання й відкриття кошика), потім
        експортуйте файл і прикріпіть до issue. Особисті дані — токени, session-id, id
        користувача, імена, email, телефон, дані картки — приховуються автоматично. Файл
        безпечно надсилати, але про всяк випадок перегляньте його перед публікацією.
      </p>
    </Section>
  );
}
