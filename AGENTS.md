# AGENTS.md

This file provides guidance to AI coding agents when working with code in this repository.

## What this is

A Chrome MV3 extension (WXT + React 19 + TypeScript) that monitors and
reserves train tickets on **booking.uz.gov.ua**. It reserves seats but never pays —
the user completes payment manually within UZ's ~15-minute hold. Personal-use tool;
keep the fair-play throttles (poll floors, 429 backoff) intact.

## Commands

```bash
pnpm dev            # dev build + HMR (Chrome) → .output/chrome-mv3
pnpm build          # production build
pnpm compile        # wxt prepare + tsc --noEmit — THE type-check / lint gate
pnpm test           # vitest run (one-shot)
pnpm test:watch     # vitest watch
```

There is no ESLint/Prettier — **`pnpm compile` is the only static gate** and tsconfig is
strict (`noUncheckedIndexedAccess`, `noUnusedLocals/Parameters`, `verbatimModuleSyntax`
→ use `import type`). Run it before considering a change done.

Run a single test file or pattern:

```bash
pnpm test src/lib/scheduler.test.ts      # one file
pnpm test -t "rate limit"                # by test name
```

Package manager is **pnpm** (lockfile present). `postinstall` runs `wxt prepare`, which
generates `.wxt/` (types, auto-imports) — needed before `tsc` works.

## Architecture: the hybrid reserve

The single most important thing to understand is **why work is split across two JS
contexts**. Monitoring and reserving run in different places on purpose:

- **Monitoring → service worker.** `orchestrator.ts` drives every job from `chrome.alarms`,
  calling the UZ API directly (read-only, fast). Requests need the SPA's `Origin`/`Referer`,
  but those are *forbidden headers* `fetch` can't set — so `net-rules.ts` installs a
  `declarativeNetRequest` session rule that rewrites them, scoped to `app.uz.gov.ua` +
  `tabIds:[-1]` (SW-only requests; the real booking.uz tab is untouched).
- **Reserving → content script in the booking.uz tab.** The reserve must reuse the live
  SPA's reCAPTCHA token and same-origin auth, so it runs *in the page*. The SW dispatches
  it over an RPC port (`bridge.ts`): `reserve-dispatch.ts` (SW) → `content.ts` (page) →
  `reserve.ts` (the actual flow). reCAPTCHA is **detected, never solved** — a challenge
  yields a `captcha` outcome, the SW focuses the tab, and a watcher auto-resumes when the
  user solves it.

### Auth flow (push + pull)

`auth-extractor.ts` (content script) heuristically scans booking.uz `localStorage` for the
JWT + `x-session-id` UUID + user id → posts it to the SW → `auth.ts` caches it in
`chrome.storage.session` and builds headers. That push alone misses tabs opened before
install/update (no live content script) and cleared SW caches — so the SW can also
**pull**: `session-probe.ts` reads the tab's `localStorage` on demand via
`chrome.scripting` and reconciles cache + badge with it (`resolveProbeDecision` is the
pure part). It runs on booking.uz navigations (incl. SPA history changes, i.e. login)
and on `authStatus` queries with an empty cache. The toolbar action icon mirrors
state by priority — amber = reservation awaiting payment, blue = active hunts,
green = session active, gray = no session — via `action-icon.ts` (pure
`resolveActionState`) and `icon-sync.ts` (recomputes on job/session changes,
arms a one-shot alarm at the nearest hold expiry; colored PNGs live in
`public/icon/states/`, regenerate with `scripts/generate-state-icons.py`).
`uz-api.ts` is context-agnostic: callers wire in a header provider + 401 handler
via `configureApi`. In the SW that provider reads the cached session (and
invalidates on 401); in the content script it reads the page session live.

### Job lifecycle

`HuntJob.state` in `models.ts` is the state machine: `idle → scheduled/hunting → reserving
→ reserved | paused | failed | cancelled`. The orchestrator owns transitions. Key invariants:

- **One global reserve at a time** — `reserveInFlight` lock in `orchestrator.ts`; other jobs
  skip their tick while it's held.
- **Three modes:** `monitor` (one-shot alarm re-armed each tick, 5–30s), `scheduled` (a
  warmup alarm ~10s before `startAt`, then a self-driving `setTimeout` sprint loop at
  200–500ms — needs the popup's keep-alive port open to hold the SW awake), `native`
  (server-side monitor, TBD/disabled).
- On 429, `scheduler.ts` computes backoff (doubled interval, honors `Retry-After`, enforces a
  fair-play minimum pause) and the job pauses until `pausedUntil`.

### Storage & UI

`store.ts` is the only persistence layer (`chrome.storage.local`: `jobs` map + capped per-job
`logs`). It exposes CRUD + a `subscribe` over `storage.onChanged`. The popup/options pages
read storage directly via the `use-store.ts` React hooks; they don't hold auth, so anything
needing the API goes through `messages.ts` (`QueryMessage`/`JobControlMessage`) to the SW's
`query-handler.ts`. UI is Ukrainian; coach types are `Л/К/П/С1/С2`.

## Conventions that recur

- **Pure core, injected effects.** Policy/parsing live in pure exported functions; side
  effects (clock, sleep, DOM captcha check, event emit, alarm calls) are injected. See
  `scheduler.ts` (pure helpers vs `schedule*`), `cart-poller.ts` (`now`/`sleep`),
  `reserve.ts` (`emit`/`isCaptchaPresent`/`uuid`), `uz-api.ts` (pure `parse*` split from
  `fetch`). Follow this when adding logic — it's what keeps things unit-testable.
- **TBD endpoints throw `NotDiscoveredError`.** Several API shapes await a fresh discovery
  HAR (see `docs/endpoints.md`). All network code is isolated in `uz-api.ts`; unconfirmed
  endpoints throw, callers feature-detect, and the UI degrades to manual entry. When an
  endpoint is confirmed, change only `uz-api.ts`.
- **Reservation POSTs never auto-retry** (`retries: 0`); the encrypted `wagon_id` can't be
  precomputed — it's fetched fresh and POSTed verbatim.
- WXT auto-imports `defineBackground`/`defineContentScript`; `browser` is imported from
  `wxt/browser`. Path alias `@/` → `src/`.

## Testing

Vitest + `WxtVitest()` plugin → in-memory `fakeBrowser` (real `chrome.storage`/`alarms`
behavior) in a `happy-dom` env. Tests typically `vi.mock('./auth')` and `vi.mock('./uz-api')`
while using the real `fakeBrowser` storage, and assert against `fixtures/*.json` (extracted
from `booking.uz.gov.ua.har`). Orchestrator/reserve modules keep module-level runtime state
(`reserveInFlight`, `sprintTimers`) — reset it with `resetOrchestratorState()` in `beforeEach`.
