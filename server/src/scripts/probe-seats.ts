import { parseWagons } from '../uz/parse.js';
import { wagonsByClassPath } from '../uz/paths.js';
import { parseArgs } from './args.js';
import { openProbeContext } from './session.js';

const args = parseArgs(process.argv.slice(2));
const tripId = Number(args.trip);
const classId = args.class ?? 'К';

if (!Number.isFinite(tripId)) {
  console.error('usage: pnpm probe:seats -- --trip <id> [--class К]');
  process.exit(2);
}

const ctx = await openProbeContext();
try {
  const path = wagonsByClassPath(tripId, classId);
  const res = await ctx.client.get(path);
  console.log(`GET ${path} -> ${res.status} (${res.body.length} bytes)`);
  if (res.kind !== 'ok') {
    console.log(res.body.slice(0, 200));
    process.exitCode = 1;
  } else {
    const wagons = parseWagons(res.json());
    console.log(`wagons: ${wagons.length}`);
    for (const wagon of wagons) {
      console.log(
        `  #${wagon.number} ${wagon.wagonKey} lower ${wagon.freeSeatsLower} / top ${wagon.freeSeatsTop} — ${(wagon.priceKop / 100).toFixed(2)} грн — seats ${wagon.seats.slice(0, 12).join(',')}${wagon.seats.length > 12 ? '…' : ''}`,
      );
    }
  }
} finally {
  await ctx.close();
}
