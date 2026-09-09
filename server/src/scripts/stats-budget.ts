import { budgetReport } from '../store/log-sqlite.js';
import { allProbes } from '../watch/probe-store.js';
import { MIN_INTERVAL_MS } from '../watch/interval.js';
import { createContext } from '../runtime/context.js';
import { parseArgs } from './args.js';

const args = parseArgs(process.argv.slice(2));
const hours = Number(args.hours ?? 24);
const since = Date.now() - hours * 3_600_000;

const ctx = await createContext({ withBrowser: false, quiet: true });
try {
  const report = budgetReport(ctx.db, since);
  const probes = allProbes(ctx.db);
  const windowHours = Math.max(report.windowMs / 3_600_000, 1 / 60);
  const bruteForce = Math.round((probes.length * windowHours * 3_600_000) / MIN_INTERVAL_MS);
  const savings = report.network > 0 ? bruteForce / report.network : 0;
  const intervals = probes.map((p) => Math.round(p.intervalMs / 60_000));
  const histogram = intervals.reduce<Record<string, number>>((acc, minutes) => {
    const key = `${minutes}хв`;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`вікно: ${windowHours.toFixed(2)} год`);
  console.log(`запитів: ${report.total} (мережа ${report.network}, кеш ${report.cached})`);
  console.log(`частота: ${Math.round(report.perHour)}/год`);
  console.log(`трафік: ${(report.bytes / 1_048_576).toFixed(1)} МБ`);
  console.log(`статуси: ${JSON.stringify(report.byStatus)}`);
  console.log(`одиниць перебору: ${probes.length}`);
  console.log(`брутфорс коштував би: ${bruteForce} запитів`);
  console.log(`економія: ${savings.toFixed(1)}x`);
  console.log(`інтервали: ${JSON.stringify(histogram)}`);
  const favorites = probes.filter((p) => p.favorite).length;
  console.log(`улюблених одиниць: ${favorites}`);
} finally {
  await ctx.close();
}
