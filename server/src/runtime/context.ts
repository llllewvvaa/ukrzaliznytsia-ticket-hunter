import { BrowserSession, type UzTransport } from '../net/browser.js';
import { UzClient } from '../net/client.js';
import { createRateLimiter } from '../net/limiter.js';
import { openDb, type Db } from '../store/db.js';
import { createSqliteCache, pruneCache } from '../store/cache-sqlite.js';
import { budgetReport, createSqliteRequestLog } from '../store/log-sqlite.js';
import { dbPath, profileDir } from './paths.js';

export interface AppContext {
  db: Db;
  client: UzClient;
  transport: UzTransport;
  close: () => Promise<void>;
}

export interface ContextOptions {
  headless?: boolean;
  withBrowser?: boolean;
  quiet?: boolean;
  perHour?: number;
}

export async function createContext(options: ContextOptions = {}): Promise<AppContext> {
  const db = openDb(dbPath());
  pruneCache(db, Date.now());

  const transport =
    options.withBrowser === false
      ? offlineTransport()
      : await BrowserSession.start({
          userDataDir: profileDir(),
          headless: options.headless ?? process.env.UZ_HEADLESS === '1',
        });

  const perHour = options.perHour ?? Number(process.env.UZ_PER_HOUR ?? 300);
  const client = new UzClient({
    transport,
    log: createSqliteRequestLog(db),
    cache: createSqliteCache(db),
    limiter: createRateLimiter({ perHour }),
  });

  return {
    db,
    client,
    transport,
    close: async () => {
      if (!options.quiet) {
        const report = budgetReport(db, Date.now() - 3_600_000);
        console.log(
          `requests last hour: ${report.network} network, ${report.cached} cached, ${Math.round(report.perHour)}/h`,
        );
      }
      await transport.close();
      db.close();
    },
  };
}

function offlineTransport(): UzTransport {
  return {
    async fetchPath() {
      throw new Error('offline_context');
    },
    async reload() {},
    async close() {},
  };
}
