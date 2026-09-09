import { openDb } from '../store/db.js';
import { dbPath } from '../runtime/paths.js';
import { parseArgs } from './args.js';

const args = parseArgs(process.argv.slice(2));
const db = openDb(dbPath());

const latest = db
  .prepare(
    `select from_id as fromId, to_id as toId, date, trip_id as tripId, class_id as classId,
            free_seats as freeSeats, price_kop as priceKop, max(taken_at) as takenAt
     from snapshot where free_seats > 0 and class_id not like 'MIX%'
     group by trip_id, class_id order by takenAt desc limit 1`,
  )
  .get() as unknown as
  | {
      fromId: number;
      toId: number;
      date: string;
      tripId: number;
      classId: string;
      freeSeats: number;
      priceKop: number;
      takenAt: number;
    }
  | undefined;

if (!latest) {
  console.log('no snapshot with free seats yet');
  process.exit(1);
}

const mode = args.mode ?? 'appeared';
if (mode === 'appeared') {
  db.prepare('update snapshot set free_seats = 0 where trip_id = ? and class_id = ?').run(
    latest.tripId,
    latest.classId,
  );
} else {
  db.prepare('update snapshot set price_kop = price_kop + 20000 where trip_id = ? and class_id = ?').run(
    latest.tripId,
    latest.classId,
  );
}

db.prepare('update probe set next_due_at = 0 where from_id = ? and to_id = ? and date = ?').run(
  latest.fromId,
  latest.toId,
  latest.date,
);

console.log(
  `armed ${mode} for trip ${latest.tripId} class ${latest.classId} on ${latest.date} (${latest.fromId} -> ${latest.toId})`,
);
db.close();
