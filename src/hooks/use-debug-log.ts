import { useCallback, useEffect, useState } from 'react';
import { query } from '@/lib/messages';
import { isDebugEnabledStored, setDebugEnabled } from '@/lib/ui/debug';
import type { DebugEvent } from '@/lib/models';

// Debug log state for the options panel: enabled flag, event count (polled
// while recording is on), and the export/clear actions.
export function useDebugLog() {
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
        [
          JSON.stringify(
            { exportedAt: new Date().toISOString(), count: events.length, events },
            null,
            2,
          ),
        ],
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

  return { on, count, busy, refresh, toggle, exportLog, clear };
}
