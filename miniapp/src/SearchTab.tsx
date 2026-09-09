import { useState } from 'react';
import { api, hryvnia, isoDate, kyivTime } from './api.js';
import { StationPicker } from './StationPicker.js';
import type { Offer, Station } from './types.js';

export function SearchTab({ onWatchCreated }: { onWatchCreated: () => void }) {
  const [from, setFrom] = useState<Station | null>(null);
  const [to, setTo] = useState<Station | null>(null);
  const [date, setDate] = useState(isoDate(7));
  const [days, setDays] = useState(1);
  const [slack, setSlack] = useState(0);
  const [sort, setSort] = useState<'cheapest' | 'balanced'>('cheapest');
  const [offers, setOffers] = useState<Offer[]>([]);
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const dates = Array.from({ length: days }, (_, index) => {
    const base = new Date(`${date}T00:00:00Z`);
    base.setUTCDate(base.getUTCDate() + index);
    return base.toISOString().slice(0, 10);
  });

  const search = async (): Promise<void> => {
    if (!from || !to) {
      setError('обери станції зі списку');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await api.ways({ fromId: from.id, toId: to.id, dates, slack, sort });
      setOffers(result.offers);
      setInfo(
        `варіантів перебору: ${result.candidates}, витрачено запитів: ${result.requests}${result.gated ? ' (гейт)' : ''}`,
      );
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const watch = async (favorite: boolean): Promise<void> => {
    if (!from || !to) return;
    setBusy(true);
    try {
      await api.createWatch({
        fromId: from.id,
        toId: to.id,
        dateFrom: dates[0]!,
        dateTo: dates[dates.length - 1]!,
        name: `${from.name} → ${to.name}`,
        favorite,
      });
      setInfo(favorite ? 'додав в улюблені' : 'стежу за цим напрямком');
      onWatchCreated();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="card">
        <StationPicker label="Звідки" value={from} onPick={setFrom} />
        <div style={{ height: 8 }} />
        <StationPicker label="Куди" value={to} onPick={setTo} />
        <div className="row">
          <div style={{ flex: 2 }}>
            <label>Дата</label>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label>Днів</label>
            <input
              type="number"
              min={1}
              max={14}
              value={days}
              onChange={(event) => setDays(Math.max(1, Math.min(14, Number(event.target.value))))}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label>± днів</label>
            <input
              type="number"
              min={0}
              max={3}
              value={slack}
              onChange={(event) => setSlack(Math.max(0, Math.min(3, Number(event.target.value))))}
            />
          </div>
        </div>
        <div className="row">
          <div style={{ flex: 1 }}>
            <label>Сортувати</label>
            <select value={sort} onChange={(event) => setSort(event.target.value as 'cheapest' | 'balanced')}>
              <option value="cheapest">найдешевше</option>
              <option value="balanced">баланс ціни й часу</option>
            </select>
          </div>
          <div style={{ flex: 1, alignSelf: 'end' }}>
            <button className="primary" style={{ width: '100%' }} disabled={busy} onClick={() => void search()}>
              {busy ? 'шукаю…' : 'Знайти'}
            </button>
          </div>
        </div>
        <div className="row">
          <button className="ghost" disabled={busy || !from || !to} onClick={() => void watch(false)}>
            Стежити
          </button>
          <button className="ghost" disabled={busy || !from || !to} onClick={() => void watch(true)}>
            В улюблені
          </button>
        </div>
        {info && <div className="muted" style={{ marginTop: 8 }}>{info}</div>}
        {error && <div className="error" style={{ marginTop: 8 }}>{error}</div>}
      </div>

      {offers.length > 0 && (
        <div className="card">
          {offers.map((offer) => (
            <div className="offer" key={`${offer.tripId}-${offer.classId}-${offer.fromId}-${offer.toId}`}>
              <div className="head">
                <span>
                  {offer.trainNumber} · {offer.className} ×{offer.freeSeats}
                </span>
                <span>{hryvnia(offer.priceKop)}</span>
              </div>
              <div className="meta">
                {kyivTime(offer.departAt)} → {kyivTime(offer.arriveAt)} · {Math.floor(offer.durationMin / 60)}г{' '}
                {offer.durationMin % 60}хв
                {offer.distanceKm ? ` · ${offer.distanceKm} км` : ''}
              </div>
              <div style={{ marginTop: 6 }}>
                {offer.kind !== 'direct' && <span className="tag detour">обхід</span>}
                <span className="tag">{offer.why}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
