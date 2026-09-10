import { chromium, type BrowserContext, type Page } from 'playwright';
import { API_BASE, BOOKING_ORIGIN } from '../uz/headers.js';

export interface PageFetchResult {
  status: number;
  body: string;
}

export interface UzTransport {
  fetchPath(path: string, headers: Record<string, string>): Promise<PageFetchResult>;
  reload(): Promise<void>;
  close(): Promise<void>;
}

export interface BrowserSessionOptions {
  userDataDir: string;
  headless?: boolean;
  locale?: string;
  executablePath?: string;
}

export const PAGE_TIMEOUT_MS = 25_000;
export const FETCH_TIMEOUT_MS = 20_000;

export class TransportTimeoutError extends Error {
  constructor(public readonly path: string) {
    super(`transport_timeout ${path}`);
    this.name = 'TransportTimeoutError';
  }
}

// A page fetch that never settles would hang the whole watcher loop, so both
// sides get a deadline: the page aborts its own request, and the caller stops
// waiting on the page.
export async function withDeadline<T>(work: Promise<T>, ms: number, path: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new TransportTimeoutError(path)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// The page's own abort and plain network failures surface as generic evaluate
// errors; they mean the same thing as our deadline and must take the same path.
export function isTransportFailure(error: unknown): boolean {
  if (error instanceof TransportTimeoutError) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /TimeoutError|signal timed out|AbortError|Failed to fetch|NetworkError|net::ERR_/i.test(message);
}

const PAGE_FETCH = async (input: { url: string; headers: Record<string, string>; timeoutMs: number }) => {
  const res = await fetch(input.url, {
    headers: input.headers,
    signal: AbortSignal.timeout(input.timeoutMs),
  });
  const body = await res.text();
  return { status: res.status, body };
};

export class BrowserSession implements UzTransport {
  private constructor(
    private readonly context: BrowserContext,
    private readonly page: Page,
  ) {}

  static async start(options: BrowserSessionOptions): Promise<BrowserSession> {
    // A server box usually has a system Chrome already; pointing at it avoids a
    // second browser download and keeps the fingerprint that UZ answers.
    const executablePath = options.executablePath ?? process.env.UZ_CHROME_PATH;
    const context = await chromium.launchPersistentContext(options.userDataDir, {
      headless: options.headless ?? false,
      locale: options.locale ?? 'uk-UA',
      viewport: { width: 1280, height: 900 },
      args: ['--no-first-run', '--no-default-browser-check'],
      ...(executablePath ? { executablePath } : {}),
    });
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(`${BOOKING_ORIGIN}/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(2_500);
    return new BrowserSession(context, page);
  }

  async fetchPath(path: string, headers: Record<string, string>): Promise<PageFetchResult> {
    try {
      return await withDeadline(
        this.page.evaluate(PAGE_FETCH, {
          url: `${API_BASE}${path}`,
          headers,
          timeoutMs: FETCH_TIMEOUT_MS,
        }),
        PAGE_TIMEOUT_MS,
        path,
      );
    } catch (error) {
      if (isTransportFailure(error)) throw new TransportTimeoutError(path);
      throw error;
    }
  }

  async reload(): Promise<void> {
    await this.page.goto(`${BOOKING_ORIGIN}/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await this.page.waitForTimeout(2_500);
  }

  async close(): Promise<void> {
    await this.context.close();
  }
}
