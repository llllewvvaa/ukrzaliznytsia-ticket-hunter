import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../store/db.js';
import { UzClient } from '../net/client.js';
import { createMemoryCache } from '../net/cache.js';
import { createMemoryRequestLog } from '../net/log.js';
import type { UzTransport } from '../net/browser.js';
import { saveTripRoute } from '../store/atlas.js';
import { createWatch } from '../store/watches.js';
import { insertEvent } from '../store/history.js';
import { handleApi, type ApiRequest } from './routes.js';
import type { TripDetail } from '../uz/types.js';

const stationsBody = JSON.stringify([{ id: 2200001, name: 'Київ-Пасажирський' }]);
const searchBody = JSON.stringify({
  direct: [
    {
      id: 1,
      depart_at: 1_700_000_000,
      arrive_at: 1_700_010_000,
      station_from: 'Бета',
      station_to: 'Дельта',
      distance: 300,
      train: { id: 5, number: '001К', wagon_classes: [{ id: 'К', name: 'Купе', free_seats: 2, price: 40_000 }] },
      monitoring: { allowed: true },
    },
  ],
  with_transfer: [],
});

function line(): TripDetail {
  return {
    id: 900,
    trainId: 90,
    trainNumber: '777Т',
    stationFromId: 20,
    stationToId: 40,
    departAt: 1_000,
    arriveAt: 5_000,
    routePoints: [
      { seq: 0, stationId: 20, stationName: 'Бета', arriveAt: null, departAt: 900 },
      { seq: 1, stationId: 40, stationName: 'Дельта', arriveAt: 3_000, departAt: null },
    ],
  };
}

function deps(db: Db) {
  const transport: UzTransport = {
    async fetchPath(path) {
      if (path.startsWith('/stations')) return { status: 200, body: stationsBody };
      if (path.startsWith('/v3/trips?')) return { status: 200, body: searchBody };
      return { status: 404, body: '{}' };
    },
    async reload() {},
    async close() {},
  };
  return {
    db,
    client: new UzClient({ transport, log: createMemoryRequestLog(), cache: createMemoryCache() }),
    now: () => 1_700_000_000_000,
  };
}

function req(over: Partial<ApiRequest>): ApiRequest {
  return { method: 'GET', path: '/api/health', query: new URLSearchParams(), body: undefined, ...over };
}

describe('api routes', () => {
  let db: Db;

  beforeEach(() => {
    db = openDb(':memory:');
    saveTripRoute(db, line(), 1_000);
  });

  it('reports health with atlas size', async () => {
    const res = await handleApi(deps(db), req({}));
    expect(res.status).toBe(200);
    expect((res.body as { atlas: { stations: number } }).atlas.stations).toBe(2);
  });

  it('searches stations only for meaningful queries', async () => {
    const empty = await handleApi(deps(db), req({ path: '/api/stations', query: new URLSearchParams('q=К') }));
    expect((empty.body as { stations: unknown[] }).stations).toHaveLength(0);
    const found = await handleApi(deps(db), req({ path: '/api/stations', query: new URLSearchParams('q=Київ') }));
    expect((found.body as { stations: unknown[] }).stations).toHaveLength(1);
  });

  it('rejects an incomplete ways request', async () => {
    const res = await handleApi(deps(db), req({ method: 'POST', path: '/api/ways', body: { fromId: 20 } }));
    expect(res.status).toBe(400);
  });

  it('returns ranked ways', async () => {
    const res = await handleApi(
      deps(db),
      req({ method: 'POST', path: '/api/ways', body: { fromId: 20, toId: 40, dates: ['2026-09-20'] } }),
    );
    const body = res.body as { offers: { priceKop: number }[]; requests: number };
    expect(body.offers.length).toBeGreaterThan(0);
    expect(body.requests).toBeGreaterThan(0);
  });

  it('creates, lists, favourites and deletes a watch', async () => {
    const created = await handleApi(
      deps(db),
      req({ method: 'POST', path: '/api/watches', body: { fromId: 20, toId: 40, dateFrom: '2026-09-20' } }),
    );
    const id = (created.body as { watch: { id: string } }).watch.id;

    const listed = await handleApi(deps(db), req({ path: '/api/watches' }));
    expect((listed.body as { watches: unknown[] }).watches).toHaveLength(1);

    const patched = await handleApi(
      deps(db),
      req({ method: 'PATCH', path: `/api/watches/${id}`, body: { favorite: true } }),
    );
    expect((patched.body as { watch: { favorite: boolean } }).watch.favorite).toBe(true);

    const deleted = await handleApi(deps(db), req({ method: 'DELETE', path: `/api/watches/${id}` }));
    expect(deleted.status).toBe(200);
    const after = await handleApi(deps(db), req({ path: '/api/watches' }));
    expect((after.body as { watches: unknown[] }).watches).toHaveLength(0);
  });

  it('lists events of a watch', async () => {
    const watch = createWatch(db, { fromId: 20, toId: 40, dateFrom: '2026-09-20' }, 1_000);
    insertEvent(db, watch.id, 'appeared', { trainNumber: '001К' }, 2_000);
    const res = await handleApi(deps(db), req({ path: `/api/watches/${watch.id}/events` }));
    expect((res.body as { events: unknown[] }).events).toHaveLength(1);
  });

  it('answers 404 for an unknown watch', async () => {
    const res = await handleApi(
      deps(db),
      req({ path: '/api/watches/00000000-0000-4000-8000-000000000000/events' }),
    );
    expect(res.status).toBe(404);
  });

  it('reports budget stats with a savings ratio', async () => {
    const res = await handleApi(deps(db), req({ path: '/api/stats' }));
    expect(res.body).toHaveProperty('savings');
    expect(res.body).toHaveProperty('probes');
  });

  it('refuses unknown routes', async () => {
    const res = await handleApi(deps(db), req({ path: '/api/nope' }));
    expect(res.status).toBe(404);
  });
});
