import { WatchEngine } from '../watch/engine.js';
import { createWatch, listWatches } from '../store/watches.js';
import { markNotified, pendingEvents } from '../store/history.js';
import { describeEvent } from '../service/format.js';
import { createContext } from '../runtime/context.js';
import { parseArgs, resolveDate } from './args.js';

const args = parseArgs(process.argv.slice(2));
const minutes = Number(args.minutes ?? 20);
const cycleSec = Number(args.cycle ?? 60);
const fromId = Number(args.from ?? 2200001);
const toId = Number(args.to ?? 2218000);
const date = resolveDate(args.date ?? '+7');

const ctx = await createContext();
try {
  if (listWatches(ctx.db, 'active').length === 0) {
    createWatch(
      ctx.db,
      { fromId, toId, dateFrom: date, name: 'demo', favorite: true, seatPrefs: {} },
      Date.now(),
    );
    console.log(`created demo watch ${fromId} -> ${toId} on ${date}`);
  }

  const engine = new WatchEngine({ db: ctx.db, client: ctx.client, config: { dateSlack: 1 } });
  const until = Date.now() + minutes * 60_000;
  let cycle = 0;

  while (Date.now() < until) {
    cycle += 1;
    const report = await engine.runCycle();
    console.log(`cycle ${cycle}: ${JSON.stringify(report)}`);
    const events = pendingEvents(ctx.db);
    for (const event of events) console.log(describeEvent(event));
    if (events.length > 0) markNotified(ctx.db, events.map((e) => e.id), Date.now());
    await new Promise((resolve) => setTimeout(resolve, cycleSec * 1_000));
  }
} finally {
  await ctx.close();
}
