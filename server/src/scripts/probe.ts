import { parseSearch } from '../uz/parse.js';
import { searchTripsPath } from '../uz/paths.js';
import { parseArgs, resolveDate } from './args.js';
import { openProbeContext } from './session.js';

const args = parseArgs(process.argv.slice(2));
const fromId = Number(args.from ?? 2200001);
const toId = Number(args.to ?? 2218000);
const date = resolveDate(args.date);
const withTransfers = args.transfers === 'true';

const ctx = await openProbeContext();
try {
  const path = searchTripsPath({ fromId, toId, date, withTransfers });
  const res = await ctx.client.get(path);
  console.log(`GET ${path} -> ${res.status} (${res.body.length} bytes, hash ${res.hash})`);
  if (res.kind !== 'ok') {
    console.log(res.body.slice(0, 200));
    process.exitCode = 1;
  } else {
    const result = parseSearch(res.json());
    const available = result.direct.filter((t) => t.classes.some((c) => c.freeSeats > 0));
    console.log(`direct trips: ${result.direct.length}, with free seats: ${available.length}`);
    console.log(`transfer variants: ${result.withTransfer.length}`);
    const offers = available.flatMap((t) =>
      t.classes.filter((c) => c.freeSeats > 0).map((c) => ({ trip: t, cls: c })),
    );
    offers.sort((a, b) => a.cls.priceKop - b.cls.priceKop);
    for (const offer of offers.slice(0, 5)) {
      const depart = new Date(offer.trip.departAt * 1000).toISOString().slice(11, 16);
      console.log(
        `  ${offer.trip.trainNumber} ${depart}UTC ${offer.cls.name} x${offer.cls.freeSeats} — ${(offer.cls.priceKop / 100).toFixed(2)} грн (trip ${offer.trip.id})`,
      );
    }
  }
} finally {
  await ctx.close();
}
