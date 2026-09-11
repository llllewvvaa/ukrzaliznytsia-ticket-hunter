import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { PROBE_COLUMNS, PROBE_SQL, SCHEMA_SQL, SCHEMA_VERSION } from './schema.js';

export type Db = DatabaseSync;

export function openDb(file: string): Db {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  // The daemon writes continuously; a CLI opened beside it must wait for the
  // write lock instead of failing at once with "database is locked".
  db.exec('pragma busy_timeout = 5000');
  db.exec('pragma journal_mode = wal');
  db.exec('pragma foreign_keys = on');
  db.exec(SCHEMA_SQL);
  migrate(db);
  db.prepare('insert or replace into meta (key, value) values (?, ?)').run(
    'schema_version',
    String(SCHEMA_VERSION),
  );
  return db;
}

function columns(db: Db, table: string): Set<string> {
  const rows = db.prepare(`pragma table_info(${table})`).all() as unknown as { name: string }[];
  return new Set(rows.map((r) => r.name));
}

function probeKeyIsStale(db: Db): boolean {
  const rows = db.prepare('pragma table_info(probe)').all() as unknown as { name: string; pk: number }[];
  if (rows.length === 0) return false;
  const withTransfers = rows.find((row) => row.name === 'with_transfers');
  return !withTransfers || withTransfers.pk === 0;
}

function rebuildProbeTable(db: Db): void {
  const list = PROBE_COLUMNS.join(', ');
  db.exec('alter table probe rename to probe_legacy');
  db.exec(PROBE_SQL);
  db.exec(`insert or ignore into probe (${list}) select ${list} from probe_legacy`);
  db.exec('drop table probe_legacy');
}

function migrate(db: Db): void {
  const probeColumns = columns(db, 'probe');
  const additions: [string, string][] = [
    ['weight', 'real not null default 1'],
    ['favorite', 'integer not null default 0'],
    ['with_transfers', 'integer not null default 0'],
  ];
  for (const [name, definition] of additions) {
    if (!probeColumns.has(name)) db.exec(`alter table probe add column ${name} ${definition}`);
  }
  if (probeKeyIsStale(db)) rebuildProbeTable(db);

  if (!columns(db, 'watch').has('alight_earlier_min')) {
    db.exec('alter table watch add column alight_earlier_min integer not null default 30');
  }

  const snapshotColumns = columns(db, 'snapshot');
  if (!snapshotColumns.has('depart_at')) {
    db.exec('alter table snapshot add column depart_at integer not null default 0');
  }
  if (!snapshotColumns.has('why')) {
    db.exec("alter table snapshot add column why text not null default ''");
  }
  if (!snapshotColumns.has('arrive_at')) {
    db.exec('alter table snapshot add column arrive_at integer not null default 0');
  }
  if (!snapshotColumns.has('legs_json')) {
    db.exec("alter table snapshot add column legs_json text not null default ''");
  }
}

export function schemaVersion(db: Db): number {
  const row = db.prepare('select value from meta where key = ?').get('schema_version') as
    | { value: string }
    | undefined;
  return row ? Number(row.value) : 0;
}
