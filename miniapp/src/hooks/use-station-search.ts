import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Station } from '../types';

export function useStationSearch(query: string, skip: boolean) {
  const [options, setOptions] = useState<Station[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (skip || query.trim().length < 2) {
      setOptions([]);
      return;
    }
    let alive = true;
    const timer = window.setTimeout(() => {
      setBusy(true);
      api
        .stations(query.trim())
        .then((res) => {
          if (alive) setOptions(res.stations.slice(0, 8));
        })
        .catch(() => {
          if (alive) setOptions([]);
        })
        .finally(() => {
          if (alive) setBusy(false);
        });
    }, 320);

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [query, skip]);

  return { options, busy };
}
