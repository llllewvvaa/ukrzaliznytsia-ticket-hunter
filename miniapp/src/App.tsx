import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import { SearchTab } from './SearchTab.js';
import { FavoritesTab } from './FavoritesTab.js';
import { HistoryTab } from './HistoryTab.js';
import type { Watch } from './types.js';

type Tab = 'search' | 'favorites' | 'history';

export function App() {
  const [tab, setTab] = useState<Tab>('search');
  const [watches, setWatches] = useState<Watch[]>([]);
  const [selected, setSelected] = useState<Watch | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(() => {
    setBusy(true);
    api
      .watches()
      .then((res) => setWatches(res.watches))
      .catch((err) => setError(String(err)))
      .finally(() => setBusy(false));
  }, []);

  useEffect(() => {
    api.ready();
    reload();
  }, [reload]);

  return (
    <div className="app">
      {tab === 'search' && <SearchTab onWatchCreated={reload} />}
      {tab === 'favorites' && (
        <FavoritesTab
          watches={watches}
          busy={busy}
          onChange={reload}
          onSelect={(watch) => {
            setSelected(watch);
            setTab('history');
          }}
        />
      )}
      {tab === 'history' && <HistoryTab watches={watches} selected={selected} />}

      {error && <div className="error">{error}</div>}

      <nav className="tabs">
        <button className={tab === 'search' ? 'active' : ''} onClick={() => setTab('search')}>
          Пошук
        </button>
        <button className={tab === 'favorites' ? 'active' : ''} onClick={() => setTab('favorites')}>
          Улюблені
        </button>
        <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>
          Історія
        </button>
      </nav>
    </div>
  );
}
