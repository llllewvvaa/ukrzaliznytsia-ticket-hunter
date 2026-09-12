import type { Db } from '../store/db.js';

export interface HealthStats {
  total: number;
  serverErrors: number;
  gated: number;
  rateLimited: number;
}

export function readHealth(db: Db, sinceTs: number): HealthStats {
  const rows = db
    .prepare(
      'select status, count(*) as n from request_log where ts >= ? and cache_hit = 0 group by status',
    )
    .all(sinceTs) as unknown as { status: number; n: number }[];

  let total = 0;
  let serverErrors = 0;
  let gated = 0;
  let rateLimited = 0;
  for (const row of rows) {
    total += row.n;
    if (row.status >= 500) serverErrors += row.n;
    if (row.status === 441) gated += row.n;
    if (row.status === 429) rateLimited += row.n;
  }
  return { total, serverErrors, gated, rateLimited };
}

export function errorRatio(stats: HealthStats): number {
  if (stats.total === 0) return 0;
  return (stats.serverErrors + stats.gated + stats.rateLimited) / stats.total;
}

export function throttleFactor(stats: HealthStats, minSamples = 10): number {
  if (stats.total < minSamples) return 1;
  const ratio = errorRatio(stats);
  if (ratio >= 0.4) return 0.25;
  if (ratio >= 0.2) return 0.5;
  return 1;
}
