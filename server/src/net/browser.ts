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
}

const PAGE_FETCH = async (input: { url: string; headers: Record<string, string> }) => {
  const res = await fetch(input.url, { headers: input.headers });
  const body = await res.text();
  return { status: res.status, body };
};

export class BrowserSession implements UzTransport {
  private constructor(
    private readonly context: BrowserContext,
    private readonly page: Page,
  ) {}

  static async start(options: BrowserSessionOptions): Promise<BrowserSession> {
    const context = await chromium.launchPersistentContext(options.userDataDir, {
      headless: options.headless ?? false,
      locale: options.locale ?? 'uk-UA',
      viewport: { width: 1280, height: 900 },
      args: ['--no-first-run', '--no-default-browser-check'],
    });
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(`${BOOKING_ORIGIN}/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.waitForTimeout(2_500);
    return new BrowserSession(context, page);
  }

  async fetchPath(path: string, headers: Record<string, string>): Promise<PageFetchResult> {
    return this.page.evaluate(PAGE_FETCH, { url: `${API_BASE}${path}`, headers });
  }

  async reload(): Promise<void> {
    await this.page.goto(`${BOOKING_ORIGIN}/`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await this.page.waitForTimeout(2_500);
  }

  async close(): Promise<void> {
    await this.context.close();
  }
}
