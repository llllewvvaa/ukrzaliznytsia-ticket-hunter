import type { Server } from 'node:http';
import type { Bot } from 'grammy';
import { createContext, type AppContext } from './context.js';
import { readConfig, type RuntimeConfig } from './config.js';
import { WatchEngine } from '../watch/engine.js';
import { startServer } from '../api/server.js';
import { createBot } from '../tg/bot.js';
import { flushEvents } from '../tg/notifier.js';
import { parseAllowedChats } from '../api/auth.js';
import { GateTrippedError } from '../net/client.js';
import { maintainAtlas } from '../atlas/maintain.js';

export interface Daemon {
  stop: () => Promise<void>;
  context: AppContext;
  config: RuntimeConfig;
}

export async function runDaemon(overrides: Partial<RuntimeConfig> = {}): Promise<Daemon> {
  const config = { ...readConfig(), ...overrides };
  const context = await createContext({ headless: config.headless, quiet: true });

  const engine = new WatchEngine({
    db: context.db,
    client: context.client,
    config: {
      perHour: config.perHour,
      maxProbesPerCycle: config.maxProbesPerCycle,
      dateSlack: config.dateSlack,
    },
  });

  let bot: Bot | undefined;
  if (config.botToken) {
    bot = createBot({
      db: context.db,
      client: context.client,
      token: config.botToken,
      miniAppUrl: config.miniAppUrl,
      allowedChats: parseAllowedChats(config.allowedChats),
    });
    void bot.start({ drop_pending_updates: true });
    console.log('telegram bot started');
  }

  const server: Server = startServer(
    { db: context.db, client: context.client },
    {
      port: config.port,
      staticDir: config.staticDir,
      botToken: config.botToken,
      allowedChats: config.allowedChats,
      devNoAuth: config.devNoAuth,
    },
  );
  console.log(`http listening on :${config.port}`);

  let stopped = false;
  const loop = async (): Promise<void> => {
    while (!stopped) {
      try {
        const atlas = await maintainAtlas({ db: context.db, client: context.client });
        if (atlas.pairs > 0) console.log(`atlas: ${JSON.stringify(atlas.results)}`);
        const report = await engine.runCycle();
        if (report.checked > 0 || report.events > 0) {
          console.log(`cycle ${JSON.stringify(report)}`);
        }
        if (bot) {
          const api = bot.api;
          await flushEvents(
            context.db,
            async (chatId, text) => {
              await api.sendMessage(chatId, text);
            },
            config.chatId,
          );
        }
      } catch (error) {
        if (error instanceof GateTrippedError) {
          console.log(`gate tripped, pausing until ${new Date(error.pausedUntil).toISOString()}`);
        } else {
          console.error('cycle failed', error);
        }
      }
      await new Promise((resolve) => setTimeout(resolve, config.cycleMs));
    }
  };
  void loop();

  return {
    config,
    context,
    stop: async () => {
      stopped = true;
      server.close();
      if (bot) await bot.stop();
      await context.close();
    },
  };
}
