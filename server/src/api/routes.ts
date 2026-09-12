import type { Db } from '../store/db.js';
import type { UzClient } from '../net/client.js';
import { findWays, lookupStations } from '../service/search.js';
import { budgetReport } from '../store/log-sqlite.js';
import { atlasStats } from '../store/atlas.js';
import { allProbes } from '../watch/probe-store.js';
import { MIN_INTERVAL_MS } from '../watch/interval.js';
import {
  createWatch,
  deleteWatch,
  getWatch,
  listWatches,
  setAlightEarlier,
  setFavorite,
  setWatchState,
  watchDates,
  type WatchInput,
} from '../store/watches.js';
import { knownRoutes, priceHistory } from '../store/history.js';
import { forecast, watchedTrains, type Horizon } from '../service/forecast.js';
import { markViewed, watchOptions } from '../store/options.js';
import type { SortMode } from '../brain/rank.js';

export interface ApiDeps {
  db: Db;
  client: UzClient;
  now?: () => number;
}

export interface ApiRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  body: unknown;
  userId?: number;
}

export interface ApiResponse {
  status: number;
  body: unknown;
}

function ok(body: unknown): ApiResponse {
  return { status: 200, body };
}

function bad(message: string): ApiResponse {
  return { status: 400, body: { error: message } };
}

export async function handleApi(deps: ApiDeps, request: ApiRequest): Promise<ApiResponse> {
  const now = deps.now ?? (() => Date.now());
  const { method, path } = request;

  if (method === 'GET' && path === '/api/health') {
    return ok({ ok: true, atlas: atlasStats(deps.db), time: now() });
  }

  if (method === 'GET' && path === '/api/stations') {
    const query = request.query.get('q') ?? '';
    if (query.length < 2) return ok({ stations: [] });
    return ok({ stations: await lookupStations(deps.client, query) });
  }

  if (method === 'POST' && path === '/api/ways') {
    const body = (request.body ?? {}) as {
      fromId?: number;
      toId?: number;
      dates?: string[];
      slack?: number;
      sort?: SortMode;
      maxPriceKop?: number;
      classes?: string[];
      budget?: number;
      alightEarlierMin?: number;
    };
    if (!body.fromId || !body.toId || !body.dates?.length)
      return bad('fromId, toId, dates required');
    const result = await findWays(deps, {
      fromId: body.fromId,
      toId: body.toId,
      dates: body.dates,
      dateSlack: body.slack ?? 0,
      maxRequests: Math.min(body.budget ?? 10, 20),
      sort: body.sort ?? 'cheapest',
      filter: { classes: body.classes, maxPriceKop: body.maxPriceKop },
      ...(typeof body.alightEarlierMin === 'number'
        ? { alightEarlierMin: body.alightEarlierMin }
        : {}),
    });
    return ok(result);
  }

  if (method === 'GET' && path === '/api/watches') {
    const watches = listWatches(deps.db).map((watch) => ({
      ...watch,
      dates: watchDates(watch),
      routes: knownRoutes(deps.db, watch.id),
    }));
    return ok({ watches });
  }

  if (method === 'POST' && path === '/api/watches') {
    const body = (request.body ?? {}) as Partial<WatchInput>;
    if (!body.fromId || !body.toId || !body.dateFrom) return bad('fromId, toId, dateFrom required');
    const watch = createWatch(
      deps.db,
      {
        ...body,
        fromId: body.fromId,
        toId: body.toId,
        dateFrom: body.dateFrom,
        chatId: body.chatId ?? request.userId ?? null,
      } as WatchInput,
      now(),
    );
    return ok({ watch });
  }

  const watchMatch = /^\/api\/watches\/([0-9a-f-]{36})(\/[a-z]+)?$/.exec(path);
  if (watchMatch) {
    const id = watchMatch[1]!;
    const sub = watchMatch[2];
    const watch = getWatch(deps.db, id);
    if (!watch) return { status: 404, body: { error: 'not_found' } };

    if (method === 'DELETE' && !sub) {
      deleteWatch(deps.db, id);
      return ok({ deleted: id });
    }

    if (method === 'PATCH' && !sub) {
      const body = (request.body ?? {}) as {
        favorite?: boolean;
        state?: 'active' | 'paused';
        alightEarlierMin?: number;
      };
      if (body.favorite != null) setFavorite(deps.db, id, body.favorite, now());
      if (typeof body.alightEarlierMin === 'number')
        setAlightEarlier(deps.db, id, body.alightEarlierMin, now());
      if (body.state) setWatchState(deps.db, id, body.state, now());
      return ok({ watch: getWatch(deps.db, id) });
    }

    if (method === 'GET' && sub === '/events') {
      const rows = deps.db
        .prepare(
          'select id, kind, payload_json as payload, created_at as createdAt, notified_at as notifiedAt from event where watch_id = ? order by created_at desc limit 100',
        )
        .all(id) as unknown as {
        id: number;
        kind: string;
        payload: string;
        createdAt: number;
        notifiedAt: number | null;
      }[];
      return ok({ events: rows.map((row) => ({ ...row, payload: JSON.parse(row.payload) })) });
    }

    if (method === 'GET' && sub === '/options') {
      const result = watchOptions(deps.db, watch, now());
      if (request.query.get('markViewed') === '1') markViewed(deps.db, id, now());
      return ok(result);
    }

    if (method === 'GET' && sub === '/history') {
      const tripId = Number(request.query.get('tripId') ?? 0);
      const classId = request.query.get('classId') ?? '';
      if (!tripId || !classId) return bad('tripId and classId required');
      return ok({ history: priceHistory(deps.db, tripId, classId) });
    }
  }

  if (method === 'GET' && path === '/api/forecast') {
    const train = request.query.get('train');
    const classId = request.query.get('class');
    if (!train || !classId) return ok({ trains: watchedTrains(deps.db) });
    const horizon = request.query.get('horizon');
    return ok({
      forecast: forecast(deps.db, {
        trainNumber: train,
        classId,
        ...(horizon ? { horizon: horizon as Horizon } : {}),
      }),
    });
  }

  if (method === 'GET' && path === '/api/stats') {
    const hours = Number(request.query.get('hours') ?? 24);
    const report = budgetReport(deps.db, now() - hours * 3_600_000, now());
    const probes = allProbes(deps.db);
    const windowHours = Math.max(report.windowMs / 3_600_000, 1 / 60);
    const bruteForce = Math.round((probes.length * windowHours * 3_600_000) / MIN_INTERVAL_MS);
    return ok({
      report,
      probes: probes.length,
      favorites: probes.filter((p) => p.favorite).length,
      bruteForce,
      savings: report.network > 0 ? bruteForce / report.network : 0,
      atlas: atlasStats(deps.db),
    });
  }

  return { status: 404, body: { error: 'unknown_route' } };
}
