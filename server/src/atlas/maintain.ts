import type { Db } from '../store/db.js';
import type { UzClient } from '../net/client.js';
import { listWatches, watchDates, type Watch } from '../store/watches.js';
import { trainsForPair } from '../store/atlas.js';
import { buildAtlas, type AtlasBuildResult } from './build.js';

export const ATLAS_REFRESH_MS = 6 * 60 * 60 * 1_000;

export interface MaintainDeps {
  db: Db;
  client: UzClient;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export function pairLastBuiltAt(db: Db, fromId: number, toId: number): number {
  const row = db
    .prepare('select last_built_at as builtAt from pair_index where from_id = ? and to_id = ?')
    .get(fromId, toId) as unknown as { builtAt: number } | undefined;
  return row?.builtAt ?? 0;
}

export function watchesNeedingAtlas(db: Db, now: number, refreshMs = ATLAS_REFRESH_MS): Watch[] {
  return listWatches(db, 'active').filter((watch) => {
    if (trainsForPair(db, watch.fromId, watch.toId).length === 0) return true;
    return now - pairLastBuiltAt(db, watch.fromId, watch.toId) > refreshMs;
  });
}

export async function maintainAtlas(
  deps: MaintainDeps,
  options: { maxPairs?: number; datesPerPair?: number; refreshMs?: number } = {},
): Promise<{ pairs: number; results: AtlasBuildResult[] }> {
  const now = deps.now ?? (() => Date.now());
  const maxPairs = options.maxPairs ?? 1;
  const datesPerPair = options.datesPerPair ?? 1;

  const pending = watchesNeedingAtlas(deps.db, now(), options.refreshMs).slice(0, maxPairs);
  const results: AtlasBuildResult[] = [];

  for (const watch of pending) {
    const dates = watchDates(watch).slice(0, datesPerPair);
    if (dates.length === 0) continue;
    results.push(
      await buildAtlas(
        { db: deps.db, client: deps.client, now, ...(deps.sleep ? { sleep: deps.sleep } : {}) },
        { fromId: watch.fromId, toId: watch.toId, dates },
      ),
    );
  }

  return { pairs: results.length, results };
}
