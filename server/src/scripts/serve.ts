import { runDaemon } from '../runtime/daemon.js';
import { parseArgs } from './args.js';

const args = parseArgs(process.argv.slice(2));
const daemon = await runDaemon({
  ...(args.port ? { port: Number(args.port) } : {}),
  ...(args.cycle ? { cycleMs: Number(args.cycle) * 1_000 } : {}),
  ...(args.dev === 'true' ? { devNoAuth: true } : {}),
});

console.log(`uz-watch running, cycle ${daemon.config.cycleMs / 1_000}s, budget ${daemon.config.perHour}/h`);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void daemon.stop().then(() => process.exit(0));
  });
}
