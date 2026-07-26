// MAIN-world debug probe: patches fetch/XHR/History to observe the SPA's own
// traffic and navigations. MAIN world has no extension APIs, so events go to the
// isolated content script via postMessage. No-op unless `active`.
export default defineContentScript({
  matches: ['https://booking.uz.gov.ua/*'],
  runAt: 'document_start',
  world: 'MAIN',
  main() {
    const CAP = 4096;
    const origin = location.origin;
    let active = false;

    function emit(ev: Record<string, unknown>): void {
      if (!active) return;
      try {
        window.postMessage(
          { __uzDebug: true, event: { ctx: 'page', t: Date.now(), ...ev } },
          origin,
        );
      } catch {
        // page world torn down mid-post — debug events are best-effort
      }
    }

    // UZ API/nav traffic only; skip static assets.
    function loggable(rawUrl: string | undefined): string | null {
      if (!rawUrl) return null;
      try {
        const u = new URL(rawUrl, location.href);
        if (!/(^|\.)uz\.gov\.ua$/.test(u.hostname)) return null;
        if (/\.(js|mjs|css|png|jpe?g|svg|gif|webp|woff2?|ttf|ico|map)(\?|$)/i.test(u.pathname)) {
          return null;
        }
        return u.href;
      } catch {
        return null;
      }
    }

    function cap(s: string): string {
      return s.length > CAP ? `${s.slice(0, CAP)}…(+${s.length - CAP})` : s;
    }

    function bodyStr(b: unknown): string {
      if (b == null) return '';
      if (typeof b === 'string') return b;
      try {
        return JSON.stringify(b);
      } catch {
        return String(b);
      }
    }

    function headersToObj(h: HeadersInit | undefined): Record<string, string> | undefined {
      if (!h) return undefined;
      const out: Record<string, string> = {};
      const put = (k: string, v: string): void => {
        out[k] = k.toLowerCase() === 'authorization' ? 'Bearer …' : v;
      };
      try {
        if (h instanceof Headers) h.forEach((v, k) => put(k, v));
        else if (Array.isArray(h)) for (const [k, v] of h) put(k, String(v));
        else for (const [k, v] of Object.entries(h)) put(k, String(v));
      } catch {
        // exotic HeadersInit — log what we managed to read
      }
      return out;
    }

    const origFetch = window.fetch;
    window.fetch = function patchedFetch(
      this: unknown,
      ...args: Parameters<typeof fetch>
    ): Promise<Response> {
      const [input, init] = args;
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : (input as Request).url;
      const method = (
        init?.method ?? (input instanceof Request ? input.method : 'GET')
      ).toUpperCase();
      const target = active ? loggable(url) : null;
      const started = Date.now();
      const p = origFetch.apply(this as never, args) as Promise<Response>;
      if (target) {
        const base = {
          kind: 'req' as const,
          method,
          url: target,
          reqHeaders: headersToObj(init?.headers),
          reqBody: cap(bodyStr(init?.body)),
        };
        p.then((res) => {
          res
            .clone()
            .text()
            .then((txt) =>
              emit({ ...base, status: res.status, ms: Date.now() - started, resBody: cap(txt) }),
            )
            .catch(() => emit({ ...base, status: res.status, ms: Date.now() - started }));
        }).catch((e) => emit({ ...base, ms: Date.now() - started, detail: String(e) }));
      }
      return p;
    } as typeof fetch;

    interface XhrDbg {
      method: string;
      url: string;
      started: number;
      headers: Record<string, string>;
    }
    const xhrDbg = new WeakMap<XMLHttpRequest, XhrDbg>();
    const xhr = XMLHttpRequest.prototype as unknown as {
      open: (...a: unknown[]) => unknown;
      send: (...a: unknown[]) => unknown;
      setRequestHeader: (...a: unknown[]) => unknown;
    };
    const origOpen = xhr.open;
    const origSend = xhr.send;
    const origSetHeader = xhr.setRequestHeader;

    xhr.open = function (this: XMLHttpRequest, method: unknown, url: unknown, ...rest: unknown[]) {
      xhrDbg.set(this, {
        method: String(method).toUpperCase(),
        url: url instanceof URL ? url.href : String(url),
        started: 0,
        headers: {},
      });
      return origOpen.call(this, method, url, ...rest);
    };
    xhr.setRequestHeader = function (this: XMLHttpRequest, name: unknown, value: unknown) {
      const d = xhrDbg.get(this);
      if (d) {
        const n = String(name);
        d.headers[n] = n.toLowerCase() === 'authorization' ? 'Bearer …' : String(value);
      }
      return origSetHeader.call(this, name, value);
    };
    xhr.send = function (this: XMLHttpRequest, body?: unknown) {
      const d = xhrDbg.get(this);
      if (d) {
        d.started = Date.now();
        const target = active ? loggable(d.url) : null;
        if (target) {
          this.addEventListener('loadend', () => {
            let resBody = '';
            try {
              resBody =
                this.responseType === '' || this.responseType === 'text'
                  ? String(this.responseText)
                  : `[${this.responseType}]`;
            } catch {
              // responseText throws for non-text responseTypes — keep the placeholder
            }
            emit({
              kind: 'req',
              method: d.method,
              url: target,
              status: this.status,
              ms: Date.now() - d.started,
              reqHeaders: d.headers,
              reqBody: cap(bodyStr(body)),
              resBody: cap(resBody),
            });
          });
        }
      }
      return origSend.call(this, body ?? null);
    };

    function snapshotStorage(reason: string): void {
      if (!active) return;
      const redact = (s: string): string =>
        s.replace(/eyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, 'jwt…');
      const dump = (store: Storage): Record<string, string> => {
        const out: Record<string, string> = {};
        for (let i = 0; i < store.length; i++) {
          const k = store.key(i);
          if (!k) continue;
          const v = redact(store.getItem(k) ?? '');
          out[k] = v.length > 3000 ? `${v.slice(0, 3000)}…(+${v.length - 3000})` : v;
        }
        return out;
      };
      try {
        let hist = '';
        try {
          hist = redact(JSON.stringify(history.state ?? null));
        } catch {
          hist = '(unserializable)';
        }
        emit({
          kind: 'note',
          label: `state:${reason}`,
          detail: JSON.stringify({
            url: location.href,
            local: dump(window.localStorage),
            session: dump(window.sessionStorage),
            historyState: hist.length > 3000 ? `${hist.slice(0, 3000)}…` : hist,
          }),
        });
      } catch (e) {
        emit({ kind: 'note', label: 'state', detail: String(e) });
      }
    }

    function nav(navType: string, to?: string, from?: string): void {
      emit({ kind: 'nav', navType, ...(to ? { to } : {}), ...(from ? { from } : {}) });
      if ((to ?? '').includes('/payment') || (to ?? '').includes('/cart')) {
        snapshotStorage('checkout-nav');
      }
    }
    const origPush = history.pushState;
    const origReplace = history.replaceState;
    history.pushState = function (this: History, ...a: Parameters<History['pushState']>) {
      const from = location.href;
      const r = origPush.apply(this, a);
      nav('push', location.href, from);
      return r;
    };
    history.replaceState = function (this: History, ...a: Parameters<History['replaceState']>) {
      const from = location.href;
      const r = origReplace.apply(this, a);
      nav('replace', location.href, from);
      return r;
    };
    window.addEventListener('popstate', () => nav('pop', location.href));
    window.addEventListener('hashchange', (e) => nav('hash', e.newURL, e.oldURL));

    window.addEventListener('message', (e: MessageEvent) => {
      if (e.source !== window) return;
      const d = e.data as { __uzDebugCtl?: boolean; enabled?: boolean } | undefined;
      if (d?.__uzDebugCtl === true) {
        const was = active;
        active = d.enabled === true;
        if (active && !was) {
          nav('enter', location.href);
          snapshotStorage('enter');
        }
      }
    });
  },
});
