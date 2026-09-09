export interface RequestLogEntry {
  ts: number;
  path: string;
  status: number;
  ms: number;
  cacheHit: boolean;
  bytes: number;
}

export interface RequestLog {
  record(entry: RequestLogEntry): void;
  entries(): readonly RequestLogEntry[];
}

export function createMemoryRequestLog(): RequestLog {
  const rows: RequestLogEntry[] = [];
  return {
    record(entry) {
      rows.push(entry);
    },
    entries() {
      return rows;
    },
  };
}

export function summarize(log: RequestLog): {
  total: number;
  network: number;
  cached: number;
  byStatus: Record<string, number>;
} {
  const rows = log.entries();
  const byStatus: Record<string, number> = {};
  let cached = 0;
  for (const row of rows) {
    if (row.cacheHit) cached += 1;
    const key = String(row.status);
    byStatus[key] = (byStatus[key] ?? 0) + 1;
  }
  return { total: rows.length, network: rows.length - cached, cached, byStatus };
}
