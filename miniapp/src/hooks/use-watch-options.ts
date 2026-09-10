import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Offer, Watch, WatchOptions } from '../types';

export function useWatchOptions(watch: Watch) {
  const [data, setData] = useState<WatchOptions | null>(null);
  const [live, setLive] = useState<Offer[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api
      .options(watch.id, true)
      .then((value) => {
        if (alive) setData(value);
      })
      .catch((err) => {
        if (alive) setError(String(err));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [watch.id]);

  const refresh = useCallback(async (): Promise<void> => {
    setRefreshing(true);
    setError('');
    try {
      const result = await api.ways({
        fromId: watch.fromId,
        toId: watch.toId,
        dates: watch.dates,
        slack: 0,
        sort: 'cheapest',
        ...(watch.classes.length > 0 ? { classes: watch.classes } : {}),
        ...(watch.maxPriceKop ? { maxPriceKop: watch.maxPriceKop } : {}),
      });
      setLive(result.offers);
    } catch (err) {
      setError(String(err));
    } finally {
      setRefreshing(false);
    }
  }, [watch]);

  return { data, live, loading, refreshing, error, refresh };
}
