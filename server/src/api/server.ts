import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { handleApi, type ApiDeps } from './routes.js';
import { isAllowed, parseAllowedChats, verifyInitData } from './auth.js';

export interface ServerOptions {
  port: number;
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

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

export function startServer(deps: ApiDeps, options: ServerOptions): Server {
  const allowed = parseAllowedChats(options.allowedChats);

  const server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const path = url.pathname;

      if (path.startsWith('/api/')) {
        let userId: number | undefined;
        if (!options.devNoAuth) {
          const initData = req.headers['x-telegram-init-data'];
          const check = verifyInitData(
            typeof initData === 'string' ? initData : '',
            options.botToken ?? '',
          );
          if (!check.ok || !isAllowed(check.userId, allowed)) {
            if (req.method && req.method !== 'GET') {
              console.log(
                `api ${req.method} ${path} -> 401 ${check.reason ?? 'forbidden'} ip=${req.socket.remoteAddress ?? '?'}`,
              );
            }
            sendJson(res, 401, { error: check.reason ?? 'forbidden' });
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
              `api ${req.method} ${path} -> ${result.status} user=${userId ?? 'dev'} ip=${req.socket.remoteAddress ?? '?'}`,
            );
          }
          sendJson(res, result.status, result.body);
        } catch (error) {
          sendJson(res, 500, { error: String(error) });
        }
        return;
      }

      if (!options.staticDir) {
        sendJson(res, 404, { error: 'no_static' });
        return;
      }

      const relative = path === '/' ? 'index.html' : normalize(path).replace(/^(\.\.[/\\])+/, '').slice(1);
      const file = join(options.staticDir, relative);
      try {
        const info = await stat(file);
        const target = info.isDirectory() ? join(file, 'index.html') : file;
        const data = await readFile(target);
        res.writeHead(200, { 'content-type': MIME[extname(target)] ?? 'application/octet-stream' });
        res.end(data);
      } catch {
        try {
          const fallback = await readFile(join(options.staticDir, 'index.html'));
          res.writeHead(200, { 'content-type': MIME['.html']! });
          res.end(fallback);
        } catch {
          sendJson(res, 404, { error: 'not_found' });
        }
      }
    })();
  });

  server.listen(options.port);
  return server;
}
