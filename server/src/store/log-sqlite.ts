import type { Db } from './db.js';
import type { RequestLog, RequestLogEntry } from '../net/log.js';

export function createSqliteRequestLog(db: Db): RequestLog {
  const insert = db.prepare(
    'insert into request_log (ts, path, status, ms, cache_hit, bytes) values (?, ?, ?, ?, ?, ?)',
  );
  return {
    record(entry: RequestLogEntry) {
      insert.run(entry.ts, entry.path, entry.status, entry.ms, entry.cacheHit ? 1 : 0, entry.bytes);
    },
    entries() {
      const rows = db
        .prepare(
          'select ts, path, status, ms, cache_hit as cacheHit, bytes from request_log order by id',
        )
        .all() as unknown as (Omit<RequestLogEntry, 'cacheHit'> & { cacheHit: number })[];
      return rows.map((r) => ({ ...r, cacheHit: r.cacheHit === 1 }));
    },
  };
}

export interface BudgetReport {
  total: number;
  network: number;
  cached: number;
  bytes: number;
  windowMs: number;
  perHour: number;
  byStatus: Record<string, number>;
}

export function budgetReport(db: Db, sinceTs = 0): BudgetReport {
  const rows = db
    .prepare(
      'select ts, status, cache_hit as cacheHit, bytes from request_log where ts >= ? order by ts',
    )
    .all(sinceTs) as unknown as { ts: number; status: number; cacheHit: number; bytes: number }[];

  const byStatus: Record<string, number> = {};
  let cached = 0;
  let bytes = 0;
  for (const row of rows) {
    if (row.cacheHit === 1) cached += 1;
    bytes += row.bytes;
    const key = String(row.status);
    byStatus[key] = (byStatus[key] ?? 0) + 1;
  }
  const first = rows[0]?.ts ?? 0;
  const last = rows[rows.length - 1]?.ts ?? 0;
  const windowMs = Math.max(1, last - first);
  const network = rows.length - cached;
  return {
    total: rows.length,
    network,
    cached,
    bytes,
    windowMs,
    perHour: (network / windowMs) * 3_600_000,
    byStatus,
  };
}
