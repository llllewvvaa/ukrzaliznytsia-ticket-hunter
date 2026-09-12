import { buildAtlas } from '../atlas/build.js';
import { atlasStats } from '../store/atlas.js';
import { createContext } from '../runtime/context.js';
import { parseArgs, resolveDate } from './args.js';

const args = parseArgs(process.argv.slice(2));
const fromId = Number(args.from ?? 2200001);
const toId = Number(args.to ?? 2218000);
const days = Number(args.days ?? 3);
const start = Number((args.start ?? '1').replace('+', ''));

const dates = Array.from({ length: days }, (_, i) => resolveDate(`+${start + i}`));
const ctx = await createContext();
try {
  console.log(`building atlas ${fromId} -> ${toId} for ${dates.join(', ')}`);
  const result = await buildAtlas({ db: ctx.db, client: ctx.client }, { fromId, toId, dates });
  console.log('build:', JSON.stringify(result));
  console.log('atlas:', JSON.stringify(atlasStats(ctx.db)));
} finally {
  await ctx.close();
}
