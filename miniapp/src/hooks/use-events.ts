import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { Forecast, WatchEvent } from '../types';

export function useEvents(watchId: string | null) {
  const [events, setEvents] = useState<WatchEvent[]>([]);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!watchId) {
      setEvents([]);
      setForecast(null);
      return;
    }
    let alive = true;
    setLoading(true);
    api
      .events(watchId)
      .then(async (res) => {
        if (!alive) return;
        setEvents(res.events);
        const latest = res.events[0];
        const train = latest ? String(latest.payload.trainNumber ?? '') : '';
        const classId = latest ? String(latest.payload.classId ?? '') : '';
        if (train && classId && !classId.startsWith('MIX')) {
          const forecastRes = await api.forecast(train, classId).catch(() => null);
          if (alive) setForecast(forecastRes?.forecast ?? null);
        } else {
          setForecast(null);
        }
      })
      .catch(() => {
        if (alive) setEvents([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [watchId]);

  return { events, forecast, loading };
}
