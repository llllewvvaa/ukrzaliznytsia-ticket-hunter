import { findWays } from '../service/search.js';
import type { SortMode } from '../brain/rank.js';
import { describeOffer, hryvnia } from '../service/format.js';
import { createContext } from '../runtime/context.js';
import { parseArgs, resolveDate } from './args.js';

const args = parseArgs(process.argv.slice(2));
const fromId = Number(args.from ?? 2200001);
const toId = Number(args.to ?? 2218000);
const days = Number(args.days ?? 1);
const slack = Number(args.slack ?? 0);
const limit = Number(args.limit ?? 10);
const maxRequests = Number(args.budget ?? 10);
const sort = (args.sort === 'balanced' ? 'balanced' : 'cheapest') as SortMode;
const start = Number(String(args.date ?? '+7').replace('+', ''));
const dates = Array.from({ length: days }, (_, i) => resolveDate(`+${start + i}`));

const ctx = await createContext();
try {
  const result = await findWays(
    { db: ctx.db, client: ctx.client },
    { fromId, toId, dates, dateSlack: slack, maxRequests, sort },
  );
  console.log(
    `candidates: ${result.candidates}, requests spent: ${result.requests}${result.gated ? ' (gated)' : ''}`,
  );
  if (result.offers.length === 0) {
    console.log('нічого не знайдено');
  }
  for (const offer of result.offers.slice(0, limit)) {
    console.log(`  ${describeOffer(offer)}`);
  }
  const best = result.offers[0];
  if (best) console.log(`найдешевший варіант: ${best.trainNumber} ${hryvnia(best.priceKop)} (${best.why})`);
} finally {
  await ctx.close();
}
