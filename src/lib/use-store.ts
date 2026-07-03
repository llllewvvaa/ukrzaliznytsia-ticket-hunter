import { useEffect, useState } from 'react';
import { getLogs, listJobs, subscribe } from './store';
import { query } from './messages';
import type { HuntJob, LogEntry } from './models';

export function useJobs(): { jobs: HuntJob[]; loading: boolean } {
  const [jobs, setJobs] = useState<HuntJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = (): void => {
      void listJobs().then((next) => {
        if (alive) {
          setJobs(next);
          setLoading(false);
        }
      });
    };
    load();
    const unsub = subscribe((change) => {
      if (change.jobs) load();
    });
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  return { jobs, loading };
}

export function useLogs(jobId: string, limit = 50): LogEntry[] {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    let alive = true;
    const load = (): void => {
      void getLogs(jobId, limit).then((next) => {
        if (alive) setLogs(next);
      });
    };
    load();
    const unsub = subscribe((change) => {
      if (change.logs) load();
    });
    return () => {
      alive = false;
      unsub();
    };
  }, [jobId, limit]);

  return logs;
}

// null = still checking; otherwise whether a UZ session token is cached.
export function useAuthStatus(): boolean | null {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    const check = async (): Promise<void> => {
      const res = await query<boolean>('authStatus');
      if (alive) setAuthed(res.ok ? Boolean(res.data) : false);
    };
    void check();
    const id = setInterval(() => void check(), 4_000);
    const onFocus = (): void => void check();
    window.addEventListener('focus', onFocus);
    return () => {
      alive = false;
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return authed;
}
