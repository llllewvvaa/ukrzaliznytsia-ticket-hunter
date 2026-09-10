import { openDb } from '../store/db.js';
import { dbPath } from '../runtime/paths.js';
import { getWatch } from '../store/watches.js';
import { digestText, selectForDigest } from '../tg/digest.js';
import type { StoredEvent } from '../store/history.js';

const db = openDb(dbPath());
const rows = db
  .prepare(
    `select id, watch_id as watchId, kind, payload_json as payload, created_at as createdAt, notified_at as notifiedAt
     from event where notified_at is not null order by notified_at desc limit 25`,
  )
  .all() as unknown as { id: number; watchId: string; kind: string; payload: string; createdAt: number; notifiedAt: number }[];

const events: StoredEvent[] = rows.map((row) => ({ ...row, payload: JSON.parse(row.payload) as Record<string, unknown> }));
const watch = getWatch(db, events[0]!.watchId)!;
const entries = selectForDigest(events, new Map(), Date.now());
console.log('---');
console.log(digestText(watch, entries, Math.max(0, events.length - entries.length)));
console.log('---');
db.close();
