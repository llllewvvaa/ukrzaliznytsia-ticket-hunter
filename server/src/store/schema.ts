export const SCHEMA_VERSION = 6;

export const PROBE_COLUMNS = [
  'from_id',
  'to_id',
  'date',
  'last_checked_at',
  'last_hash',
  'unchanged_streak',
  'interval_ms',
  'next_due_at',
  'checks',
  'changes',
  'weight',
  'favorite',
  'with_transfers',
] as const;

export const PROBE_SQL = `create table if not exists probe (
  from_id integer not null,
  to_id integer not null,
  date text not null,
  last_checked_at integer not null default 0,
  last_hash text,
  unchanged_streak integer not null default 0,
  interval_ms integer not null default 300000,
  next_due_at integer not null default 0,
  checks integer not null default 0,
  changes integer not null default 0,
  weight real not null default 1,
  favorite integer not null default 0,
  with_transfers integer not null default 0,
  primary key (from_id, to_id, date, with_transfers)
);
create index if not exists probe_due on probe (next_due_at);`;

export const SCHEMA_SQL = `
create table if not exists meta (
  key text primary key,
  value text not null
);

create table if not exists station (
  id integer primary key,
  name text not null,
  updated_at integer not null
);

create table if not exists train (
  id integer primary key,
  number text not null,
  station_from text,
  station_to text,
  updated_at integer not null
);

create table if not exists trip_route (
  trip_id integer not null,
  seq integer not null,
  train_id integer not null,
  train_number text not null,
  station_id integer not null,
  station_name text not null,
  arrive_at integer,
  depart_at integer,
  built_at integer not null,
  primary key (trip_id, seq)
);
create index if not exists trip_route_station on trip_route (station_id);
create index if not exists trip_route_train on trip_route (train_id);

create table if not exists pair_index (
  from_id integer not null,
  to_id integer not null,
  train_ids text not null,
  last_built_at integer not null,
  primary key (from_id, to_id)
);

create table if not exists watch (
  id text primary key,
  chat_id integer,
  name text,
  from_id integer not null,
  to_id integer not null,
  date_from text not null,
  date_to text not null,
  classes text not null default '[]',
  seat_prefs text not null default '{}',
  max_price_kop integer,
  favorite integer not null default 0,
  priority integer not null default 0,
  state text not null default 'active',
  created_at integer not null,
  updated_at integer not null
);

${PROBE_SQL}

create table if not exists snapshot (
  id integer primary key autoincrement,
  taken_at integer not null,
  from_id integer not null,
  to_id integer not null,
  date text not null,
  trip_id integer not null,
  train_number text not null,
  class_id text not null,
  free_seats integer not null,
  price_kop integer not null,
  source text not null,
  depart_at integer not null default 0,
  why text not null default '',
  arrive_at integer not null default 0,
  legs_json text not null default ''
);
create index if not exists snapshot_key on snapshot (trip_id, class_id, taken_at);
create index if not exists snapshot_pair on snapshot (from_id, to_id, date, taken_at);

create table if not exists seat_snapshot (
  id integer primary key autoincrement,
  taken_at integer not null,
  trip_id integer not null,
  class_id text not null,
  wagon_number text not null,
  wagon_key text not null,
  seats_json text not null,
  free_lower integer not null,
  free_top integer not null,
  price_kop integer not null
);
create index if not exists seat_snapshot_key on seat_snapshot (trip_id, class_id, taken_at);

create table if not exists event (
  id integer primary key autoincrement,
  watch_id text not null,
  kind text not null,
  payload_json text not null,
  created_at integer not null,
  notified_at integer
);
create index if not exists event_pending on event (notified_at, created_at);

create table if not exists route_memory (
  watch_id text not null,
  route_key text not null,
  route_json text not null,
  first_seen_at integer not null,
  last_hit_at integer not null,
  hits integer not null default 1,
  primary key (watch_id, route_key)
);

create table if not exists announced (
  watch_id text not null,
  date text not null,
  train_number text not null,
  announced_at integer not null,
  cleared_at integer,
  primary key (watch_id, date, train_number)
);

create table if not exists path_memory (
  path_template text primary key,
  status integer not null,
  checked_at integer not null,
  ttl_s integer not null
);

create table if not exists request_log (
  id integer primary key autoincrement,
  ts integer not null,
  path text not null,
  status integer not null,
  ms integer not null,
  cache_hit integer not null,
  bytes integer not null
);
create index if not exists request_log_ts on request_log (ts);

create table if not exists response_cache (
  key text primary key,
  body text not null,
  status integer not null,
  hash text not null,
  fetched_at integer not null,
  expires_at integer not null
);
create index if not exists response_cache_expiry on response_cache (expires_at);
`;
