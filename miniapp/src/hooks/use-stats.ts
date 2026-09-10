import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Stats } from '../types';

export function useStats(refreshKey = 0) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .stats()
      .then((value) => {
        if (alive) setStats(value);
      })
      .catch(() => {
        if (alive) setStats(null);
      });
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  return stats;
}
