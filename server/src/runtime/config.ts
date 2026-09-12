export interface RuntimeConfig {
  port: number;
  host: string;
  appSecret: string;
  cycleMs: number;
  watchdogMs: number;
  perHour: number;
  maxProbesPerCycle: number;
  dateSlack: number;
  botToken: string;
  chatId: number | null;
  allowedChats: string;
  miniAppUrl: string;
  staticDir: string;
  devNoAuth: boolean;
  headless: boolean;
}

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  return {
    port: num(env.UZ_PORT, 8848),
    host: env.UZ_HOST ?? '127.0.0.1',
    appSecret: env.UZ_APP_SECRET ?? '',
    cycleMs: num(env.UZ_CYCLE_MS, 60_000),
    watchdogMs: num(env.UZ_WATCHDOG_MS, 8 * 60_000),
    perHour: num(env.UZ_PER_HOUR, 180),
    maxProbesPerCycle: num(env.UZ_MAX_PROBES, 6),
    dateSlack: num(env.UZ_DATE_SLACK, 1),
    botToken: env.UZ_BOT_TOKEN ?? '',
    chatId: env.UZ_CHAT_ID ? num(env.UZ_CHAT_ID, 0) || null : null,
    allowedChats: env.UZ_ALLOWED_CHATS ?? '',
    miniAppUrl: env.UZ_MINIAPP_URL ?? '',
    staticDir: env.UZ_STATIC_DIR ?? new URL('../../../miniapp/dist', import.meta.url).pathname,
    devNoAuth: env.UZ_DEV_NO_AUTH === '1',
    headless: env.UZ_HEADLESS === '1',
  };
}
