import { useEffect, useState } from 'react';
import { api, hryvnia } from './api.js';
import type { Stats, Watch, WatchEvent } from './types.js';

const KIND_TITLE: Record<string, string> = {
  appeared: 'зʼявилися місця',
  price_drop: 'ціна впала',
  more_seats: 'більше місць',
  gone: 'місця зникли',
};

export function HistoryTab({ watches, selected }: { watches: Watch[]; selected: Watch | null }) {
  const [watchId, setWatchId] = useState(selected?.id ?? watches[0]?.id ?? '');
  const [events, setEvents] = useState<WatchEvent[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (selected) setWatchId(selected.id);
  }, [selected]);

  useEffect(() => {
    api.stats().then(setStats).catch((err) => setError(String(err)));
  }, []);

  useEffect(() => {
    if (!watchId) return;
    api
      .events(watchId)
      .then((res) => setEvents(res.events))
      .catch((err) => setError(String(err)));
  }, [watchId]);

  return (
    <>
      <div className="card">
        <label>Стеження</label>
        <select value={watchId} onChange={(event) => setWatchId(event.target.value)}>
          {watches.map((watch) => (
            <option key={watch.id} value={watch.id}>
              {watch.name}
            </option>
          ))}
        </select>
      </div>

      {stats && (
        <div className="card">
          <div className="stat">
            <span className="muted">запитів (мережа / кеш)</span>
            <span>
              {stats.report.network} / {stats.report.cached}
            </span>
          </div>
          <div className="stat">
            <span className="muted">частота</span>
            <span>{Math.round(stats.report.perHour)}/год</span>
          </div>
          <div className="stat">
            <span className="muted">одиниць перебору</span>
            <span>
              {stats.probes} (улюблених {stats.favorites})
            </span>
          </div>
          <div className="stat">
            <span className="muted">економія проти брутфорсу</span>
            <span>{stats.savings.toFixed(1)}x</span>
          </div>
          <div className="stat">
            <span className="muted">атлас</span>
            <span>
              {stats.atlas.stations} станцій · {stats.atlas.trips} маршрутів · {stats.atlas.pairs} пар
            </span>
          </div>
        </div>
      )}

      <div className="card">
        {events.length === 0 && <div className="muted">Подій ще немає.</div>}
        {events.map((event) => {
          const payload = event.payload as Record<string, unknown>;
          const seats = Array.isArray(payload.seats) ? (payload.seats as Record<string, unknown>[]) : [];
          return (
            <div className="offer" key={event.id}>
              <div className="head">
                <span>
                  {KIND_TITLE[event.kind] ?? event.kind} · {String(payload.trainNumber ?? '')}
                </span>
                <span>{hryvnia(Number(payload.priceKop ?? 0))}</span>
              </div>
              <div className="meta">
                {String(payload.date ?? '')} · {String(payload.className ?? payload.classId ?? '')} ×
                {Number(payload.freeSeats ?? 0)} · {new Date(event.createdAt).toLocaleString('uk-UA')}
              </div>
              {String(payload.why ?? '') !== 'прямий напрямок' && (
                <div style={{ marginTop: 6 }}>
                  <span className="tag detour">{String(payload.why ?? '')}</span>
                </div>
              )}
              {seats.slice(0, 2).map((wagon, index) => (
                <div className="muted" key={index} style={{ marginTop: 4 }}>
                  вагон {String(wagon.wagon)} · нижніх {Number(wagon.lower)}, верхніх {Number(wagon.upper)} ·{' '}
                  {Array.isArray(wagon.seats) ? (wagon.seats as number[]).join(', ') : ''}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {error && <div className="error">{error}</div>}
    </>
  );
}
