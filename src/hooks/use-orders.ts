import { useCallback, useEffect, useState } from 'react';
import { query } from '@/lib/messages';
import type { ActiveOrdersResponse, ArchivedOrdersResponse, UserOrder } from '@/lib/models';

export type LoadState = 'loading' | 'ok' | 'auth' | 'error';

// Loads active orders first, then the first archived page sequentially — the
// auth/error status of either request decides the whole view state.
export function useOrders() {
  const [active, setActive] = useState<UserOrder[]>([]);
  const [archived, setArchived] = useState<UserOrder[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [state, setState] = useState<LoadState>('loading');

  const loadArchived = useCallback(async (p: number): Promise<LoadState> => {
    const res = await query<ArchivedOrdersResponse>('archivedOrders', { page: p });
    if (!res.ok) return res.code === 'not_authenticated' ? 'auth' : 'error';
    setArchived(res.data?.orders ?? []);
    setTotalPages(res.data?.pagination.total_pages ?? 1);
    setPage(p);
    return 'ok';
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const act = await query<ActiveOrdersResponse>('activeOrders');
      if (!alive) return;
      if (!act.ok) {
        setState(act.code === 'not_authenticated' ? 'auth' : 'error');
        return;
      }
      setActive(act.data?.orders ?? []);
      const archStatus = await loadArchived(1);
      if (alive) setState(archStatus);
    })();
    return () => {
      alive = false;
    };
  }, [loadArchived]);

  return { active, archived, page, totalPages, state, loadArchived };
}
