import { openDb } from '../store/db.js';
import { dbPath } from '../runtime/paths.js';
import { getWatch } from '../store/watches.js';
import { announcementText, groupByDate, newTrainsFrom } from '../tg/announce.js';
import type { StoredEvent } from '../store/history.js';

const db = openDb(dbPath());
const rows = db
  .prepare(
    `select id, watch_id as watchId, kind, payload_json as payload, created_at as createdAt, notified_at as notifiedAt
     from event where kind = 'appeared' order by created_at desc limit 200`,
  )
  .all() as unknown as { id: number; watchId: string; kind: string; payload: string; createdAt: number; notifiedAt: number | null }[];

const byWatch = new Map<string, StoredEvent[]>();
for (const row of rows) {
  const event: StoredEvent = { ...row, payload: JSON.parse(row.payload) as Record<string, unknown> };
  byWatch.set(row.watchId, [...(byWatch.get(row.watchId) ?? []), event]);
}

for (const [watchId, events] of byWatch) {
  const watch = getWatch(db, watchId);
  if (!watch) continue;
  console.log('---');
  console.log(announcementText(watch, groupByDate(newTrainsFrom(events))));
}
db.close();
