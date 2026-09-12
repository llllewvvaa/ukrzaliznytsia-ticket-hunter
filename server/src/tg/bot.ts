import { Bot } from 'grammy';
import type { Db } from '../store/db.js';
import type { UzClient } from '../net/client.js';
import { budgetReport } from '../store/log-sqlite.js';
import { allProbes } from '../watch/probe-store.js';
import { knownRoutes } from '../store/history.js';
import {
  createWatch,
  listWatches,
  setFavorite,
  setWatchState,
  type Watch,
} from '../store/watches.js';
import { findWays, lookupStations } from '../service/search.js';
import { forecast, watchedTrains } from '../service/forecast.js';
import { rememberChat } from '../store/meta.js';
import { describeOffer, hryvnia } from '../service/format.js';
import { resolveDate } from '../scripts/args.js';

export interface BotDeps {
  db: Db;
  client: UzClient;
  token: string;
  miniAppUrl?: string;
  allowedChats: number[];
}

function guard(deps: BotDeps, chatId: number | undefined): boolean {
  if (deps.allowedChats.length === 0) return true;
  return chatId != null && deps.allowedChats.includes(chatId);
}

function watchLine(index: number, watch: Watch, routes: number): string {
  const star = watch.favorite ? '★' : '·';
  const state = watch.state === 'active' ? '' : ` [${watch.state}]`;
  const detours = routes > 0 ? ` · знайдених обхідних: ${routes}` : '';
  return `${index}. ${star} ${watch.name} ${watch.dateFrom}…${watch.dateTo}${state}${detours}`;
}

export function createBot(deps: BotDeps): Bot {
  const bot = new Bot(deps.token);

  bot.use(async (ctx, next) => {
    const chatId = ctx.chat?.id;
    if (chatId != null && guard(deps, chatId)) rememberChat(deps.db, chatId);
    await next();
  });

  bot.command('start', async (ctx) => {
    if (!guard(deps, ctx.chat?.id)) return;
    const lines = [
      'Стежу за квитками УЗ і пишу, коли зʼявляється спосіб доїхати.',
      'Команди: /ways, /watch, /list, /fav, /pause, /resume, /cheapest, /forecast, /stats',
    ];
    if (deps.miniAppUrl) lines.push(`Інтерфейс: ${deps.miniAppUrl}`);
    await ctx.reply(lines.join('\n'));
  });

  bot.command('ways', async (ctx) => {
    if (!guard(deps, ctx.chat?.id)) return;
    const parts = (ctx.match ?? '').toString().trim().split(/\s+/).filter(Boolean);
    if (parts.length < 2) {
      await ctx.reply('Формат: /ways Київ Львів +7');
      return;
    }
    const [fromName, toName, dateArg] = parts;
    const from = (await lookupStations(deps.client, fromName!))[0];
    const to = (await lookupStations(deps.client, toName!))[0];
    if (!from || !to) {
      await ctx.reply('Не знайшов станції. Спробуй іншу назву.');
      return;
    }
    const date = resolveDate(dateArg ?? '+7');
    const result = await findWays(deps, {
      fromId: from.id,
      toId: to.id,
      dates: [date],
      maxRequests: 8,
    });
    if (result.offers.length === 0) {
      await ctx.reply(
        `${from.name} → ${to.name} ${date}: нічого не знайшов (запитів: ${result.requests})`,
      );
      return;
    }
    const lines = result.offers.slice(0, 8).map((offer) => `· ${describeOffer(offer)}`);
    await ctx.reply([`${from.name} → ${to.name} ${date}`, ...lines].join('\n'));
  });

  bot.command('list', async (ctx) => {
    if (!guard(deps, ctx.chat?.id)) return;
    const watches = listWatches(deps.db);
    if (watches.length === 0) {
      await ctx.reply('Стежень немає. Створи у Mini App або /watch Київ Львів +7');
      return;
    }
    const lines = watches.map((watch, index) =>
      watchLine(index + 1, watch, knownRoutes(deps.db, watch.id).length),
    );
    await ctx.reply(lines.join('\n'));
  });

  bot.command('watch', async (ctx) => {
    if (!guard(deps, ctx.chat?.id)) return;
    const parts = (ctx.match ?? '').toString().trim().split(/\s+/).filter(Boolean);
    if (parts.length < 2) {
      await ctx.reply('Формат: /watch Київ Львів +7 [днів]');
      return;
    }
    const [fromName, toName, dateArg, daysArg] = parts;
    const from = (await lookupStations(deps.client, fromName!))[0];
    const to = (await lookupStations(deps.client, toName!))[0];
    if (!from || !to) {
      await ctx.reply('Не знайшов станції.');
      return;
    }
    const dateFrom = resolveDate(dateArg ?? '+7');
    const days = Math.max(1, Math.min(Number(daysArg ?? 1), 14));
    const end = new Date(`${dateFrom}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + days - 1);
    const watch = createWatch(
      deps.db,
      {
        fromId: from.id,
        toId: to.id,
        dateFrom,
        dateTo: end.toISOString().slice(0, 10),
        name: `${from.name} → ${to.name}`,
        chatId: ctx.chat?.id ?? null,
      },
      Date.now(),
    );
    await ctx.reply(`Стежу: ${watch.name} ${watch.dateFrom}…${watch.dateTo}`);
  });

  const byIndex = (index: number): Watch | undefined => listWatches(deps.db)[index - 1];

  bot.command('fav', async (ctx) => {
    if (!guard(deps, ctx.chat?.id)) return;
    const index = Number((ctx.match ?? '').toString().trim());
    const watch = byIndex(index);
    if (!watch) {
      await ctx.reply('Формат: /fav 1');
      return;
    }
    setFavorite(deps.db, watch.id, !watch.favorite, Date.now());
    await ctx.reply(`${watch.name}: ${watch.favorite ? 'прибрав з улюблених' : 'в улюблених'}`);
  });

  bot.command('pause', async (ctx) => {
    if (!guard(deps, ctx.chat?.id)) return;
    const watch = byIndex(Number((ctx.match ?? '').toString().trim()));
    if (!watch) {
      await ctx.reply('Формат: /pause 1');
      return;
    }
    setWatchState(deps.db, watch.id, 'paused', Date.now());
    await ctx.reply(`${watch.name}: пауза`);
  });

  bot.command('resume', async (ctx) => {
    if (!guard(deps, ctx.chat?.id)) return;
    const watch = byIndex(Number((ctx.match ?? '').toString().trim()));
    if (!watch) {
      await ctx.reply('Формат: /resume 1');
      return;
    }
    setWatchState(deps.db, watch.id, 'active', Date.now());
    await ctx.reply(`${watch.name}: знову стежу`);
  });

  bot.command('forecast', async (ctx) => {
    if (!guard(deps, ctx.chat?.id)) return;
    const parts = (ctx.match ?? '').toString().trim().split(/\s+/).filter(Boolean);
    if (parts.length < 1) {
      const rows = watchedTrains(deps.db, 8);
      if (rows.length === 0) {
        await ctx.reply('Історії ще немає — стеження щойно почалось.');
        return;
      }
      await ctx.reply(
        [
          'Є історія по:',
          ...rows.map((r) => `· ${r.trainNumber} ${r.classId} — ${r.rows} записів`),
          'Формат: /forecast 017О К',
        ].join('\n'),
      );
      return;
    }
    const [train, classId] = parts;
    const result = forecast(deps.db, { trainNumber: train!, classId: classId ?? 'К' });
    await ctx.reply(
      result.probability == null
        ? `${result.trainNumber} ${result.classId}: ${result.note}`
        : `${result.trainNumber} ${result.classId}: після порожньої перевірки місця зʼявлялися у ${Math.round(result.probability * 100)}% випадків (${result.observations} спостережень)`,
    );
  });

  bot.command('stats', async (ctx) => {
    if (!guard(deps, ctx.chat?.id)) return;
    const report = budgetReport(deps.db, Date.now() - 3_600_000);
    const probes = allProbes(deps.db);
    const favorites = probes.filter((p) => p.favorite).length;
    await ctx.reply(
      [
        `запитів за годину: ${report.network} (кеш ${report.cached})`,
        `частота: ${Math.round(report.perHour)}/год`,
        `трафік: ${(report.bytes / 1_048_576).toFixed(1)} МБ`,
        `одиниць перебору: ${probes.length}, улюблених: ${favorites}`,
      ].join('\n'),
    );
  });

  bot.command('cheapest', async (ctx) => {
    if (!guard(deps, ctx.chat?.id)) return;
    const watches = listWatches(deps.db, 'active');
    if (watches.length === 0) {
      await ctx.reply('Немає активних стежень.');
      return;
    }
    const watch = watches[0]!;
    const result = await findWays(deps, {
      fromId: watch.fromId,
      toId: watch.toId,
      dates: [watch.dateFrom],
      maxRequests: 6,
    });
    const best = result.offers[0];
    await ctx.reply(
      best
        ? `${watch.name}: найдешевше ${best.trainNumber} ${hryvnia(best.priceKop)} · ${best.why}`
        : `${watch.name}: поки нічого`,
    );
  });

  return bot;
}
