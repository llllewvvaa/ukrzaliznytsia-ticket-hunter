import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { handleApi, type ApiDeps } from './routes.js';
import {
  isAllowed,
  isBlocked,
  parseAllowedChats,
  recordFailure,
  verifyInitData,
  type FailureWindow,
} from './auth.js';

export interface ServerOptions {
  port: number;
  host?: string;
  appSecret?: string;
  staticDir?: string;
  botToken?: string;
  allowedChats?: string;
  devNoAuth?: boolean;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (chunks.length === 0) return undefined;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf-8')) as unknown;
  } catch {
    return undefined;
  }
}

const SECURITY_HEADERS: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'content-security-policy': [
    "default-src 'self'",
    "script-src 'self' https://telegram.org",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors https://web.telegram.org https://*.telegram.org",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; '),
};

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function sendNotFound(res: ServerResponse): void {
  res.writeHead(404, { ...SECURITY_HEADERS, 'content-type': 'text/plain; charset=utf-8' });
  res.end('not found');
}

export function staticRelative(path: string, secret: string): string | null {
  const prefix = secret ? `/${secret}` : '';
  if (prefix && path !== prefix && !path.startsWith(`${prefix}/`)) return null;
  const rest = path.slice(prefix.length) || '/';
  const normalized = normalize(rest).replace(/^(\.\.[/\\])+/, '');
  if (normalized.includes('..')) return null;
  return normalized === '/' || normalized === '' ? 'index.html' : normalized.replace(/^\/+/, '');
}

export function startServer(deps: ApiDeps, options: ServerOptions): Server {
  const allowed = parseAllowedChats(options.allowedChats);
  const failures = new Map<string, FailureWindow>();

  const server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const path = url.pathname;
      const forwarded = req.headers['cf-connecting-ip'] ?? req.headers['x-forwarded-for'];
      const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim() ?? req.socket.remoteAddress ?? '?';

      if (path.startsWith('/api/')) {
        let userId: number | undefined;
        if (!options.devNoAuth) {
          if (isBlocked(failures, ip, Date.now())) {
            sendJson(res, 429, { error: 'too_many_failures' });
            return;
          }
          const initData = req.headers['x-telegram-init-data'];
          const check = verifyInitData(
            typeof initData === 'string' ? initData : '',
            options.botToken ?? '',
          );
          if (!check.ok || !isAllowed(check.userId, allowed)) {
            const window = recordFailure(failures, ip, Date.now());
            console.log(
              `api ${req.method ?? '?'} ${path} -> 401 ${check.ok ? 'not_allowed' : (check.reason ?? 'forbidden')} ip=${ip} failures=${window.count}`,
            );
            sendJson(res, 401, { error: 'unauthorized' });
            return;
          }
          userId = check.userId;
        }

        const body = req.method === 'POST' || req.method === 'PATCH' ? await readBody(req) : undefined;
        try {
          const result = await handleApi(deps, {
            method: req.method ?? 'GET',
            path,
            query: url.searchParams,
            body,
            userId,
          });
          // A public endpoint needs a trail of who changed what; reads stay silent.
          if (req.method && req.method !== 'GET') {
            console.log(
              `api ${req.method} ${path} -> ${result.status} user=${userId ?? 'dev'} ip=${ip}`,
            );
          }
          sendJson(res, result.status, result.body);
        } catch (error) {
          sendJson(res, 500, { error: String(error) });
        }
        return;
      }

      if (!options.staticDir) {
        sendNotFound(res);
        return;
      }

      const relative = staticRelative(path, options.appSecret ?? '');
      if (relative === null) {
        sendNotFound(res);
        return;
      }

      const file = join(options.staticDir, relative);
      try {
        const info = await stat(file);
        const target = info.isDirectory() ? join(file, 'index.html') : file;
        const data = await readFile(target);
        res.writeHead(200, {
          ...SECURITY_HEADERS,
          'content-type': MIME[extname(target)] ?? 'application/octet-stream',
        });
        res.end(data);
      } catch {
        try {
          const fallback = await readFile(join(options.staticDir, 'index.html'));
          res.writeHead(200, { ...SECURITY_HEADERS, 'content-type': MIME['.html']! });
          res.end(fallback);
        } catch {
          sendNotFound(res);
        }
      }
    })();
  });

  server.listen(options.port, options.host ?? '127.0.0.1');
  return server;
}
