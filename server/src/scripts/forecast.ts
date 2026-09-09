import { forecast, watchedTrains, type Horizon } from '../service/forecast.js';
import { hryvnia } from '../service/format.js';
import { openDb } from '../store/db.js';
import { dbPath } from '../runtime/paths.js';
import { parseArgs } from './args.js';

const args = parseArgs(process.argv.slice(2));
const db = openDb(dbPath());

if (!args.train) {
  console.log('накопичена історія (потяг / клас / записів):');
  for (const row of watchedTrains(db)) {
    console.log(`  ${row.trainNumber} ${row.classId} — ${row.rows}`);
  }
  console.log('уточни: pnpm forecast -- --train 017О --class К [--horizon last_day]');
} else {
  const result = forecast(db, {
    trainNumber: args.train,
    classId: args.class ?? 'К',
    ...(args.horizon ? { horizon: args.horizon as Horizon } : {}),
  });
  console.log(`${result.trainNumber} ${result.classId} · горизонт ${result.horizon}`);
  console.log(`спостережень: ${result.observations}, з них порожніх: ${result.emptyObservations}`);
  console.log(
    result.probability == null
      ? result.note
      : `частота появи місць після порожньої перевірки: ${(result.probability * 100).toFixed(0)}%`,
  );
  if (result.medianPriceKop != null) console.log(`медіанна ціна: ${hryvnia(result.medianPriceKop)}`);
}

db.close();
