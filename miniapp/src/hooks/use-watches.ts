import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Watch } from '../types';

export function useWatches() {
  const [watches, setWatches] = useState<Watch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await api.watches();
      setWatches(res.watches);
      setError('');
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const toggleFavorite = useCallback(
    async (watch: Watch): Promise<void> => {
      await api.patchWatch(watch.id, { favorite: !watch.favorite });
      await reload();
    },
    [reload],
  );

  const togglePause = useCallback(
    async (watch: Watch): Promise<void> => {
      await api.patchWatch(watch.id, { state: watch.state === 'active' ? 'paused' : 'active' });
      await reload();
    },
    [reload],
  );

  const remove = useCallback(
    async (watch: Watch): Promise<void> => {
      await api.deleteWatch(watch.id);
      await reload();
    },
    [reload],
  );

  return { watches, loading, error, reload, toggleFavorite, togglePause, remove };
}
