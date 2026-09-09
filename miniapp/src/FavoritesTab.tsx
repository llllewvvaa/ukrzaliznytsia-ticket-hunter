import { api } from './api.js';
import type { Watch } from './types.js';

export function FavoritesTab({
  watches,
  busy,
  onChange,
  onSelect,
}: {
  watches: Watch[];
  busy: boolean;
  onChange: () => void;
  onSelect: (watch: Watch) => void;
}) {
  const act = async (action: Promise<unknown>): Promise<void> => {
    await action;
    onChange();
  };

  const favorites = watches.filter((watch) => watch.favorite);
  const others = watches.filter((watch) => !watch.favorite);

  const card = (watch: Watch) => (
    <div className="card" key={watch.id}>
      <div className="head" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <strong>{watch.name}</strong>
        <span className="muted">
          {watch.dateFrom}
          {watch.dateTo !== watch.dateFrom ? `…${watch.dateTo}` : ''}
        </span>
      </div>
      <div style={{ marginTop: 6 }}>
        {watch.favorite && <span className="tag fav">улюблене</span>}
        <span className="tag">{watch.state === 'active' ? 'стежу' : 'пауза'}</span>
        {watch.routes.length > 0 && <span className="tag detour">обхідних шляхів: {watch.routes.length}</span>}
      </div>
      {watch.routes.length > 0 && (
        <div className="muted" style={{ marginTop: 6 }}>
          {watch.routes.slice(0, 3).map((route) => (
            <div key={route.routeKey}>
              {String(route.route.why ?? route.routeKey)} · спрацювало {route.hits}
            </div>
          ))}
        </div>
      )}
      <div className="row" style={{ marginTop: 10 }}>
        <button
          className={watch.favorite ? 'ghost on' : 'ghost'}
          disabled={busy}
          onClick={() => void act(api.patchWatch(watch.id, { favorite: !watch.favorite }))}
        >
          {watch.favorite ? 'Прибрати' : 'В улюблені'}
        </button>
        <button
          className="ghost"
          disabled={busy}
          onClick={() =>
            void act(api.patchWatch(watch.id, { state: watch.state === 'active' ? 'paused' : 'active' }))
          }
        >
          {watch.state === 'active' ? 'Пауза' : 'Продовжити'}
        </button>
        <button className="ghost" disabled={busy} onClick={() => onSelect(watch)}>
          Історія
        </button>
        <button className="ghost" disabled={busy} onClick={() => void act(api.deleteWatch(watch.id))}>
          Видалити
        </button>
      </div>
    </div>
  );

  return (
    <>
      {watches.length === 0 && (
        <div className="card muted">Стежень немає. Створи на вкладці «Пошук».</div>
      )}
      {favorites.length > 0 && <h1>Улюблені</h1>}
      {favorites.map(card)}
      {others.length > 0 && <h1>Інші стеження</h1>}
      {others.map(card)}
    </>
  );
}
