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
pnpm compile        # wxt prepare + tsc --noEmit — type-check gate
pnpm lint           # eslint (flat config) — 0 errors allowed, a11y runs as warnings
pnpm format         # prettier --write .
pnpm format:check   # prettier --check . (CI gate)
pnpm test           # vitest run (one-shot)
pnpm test:watch     # vitest watch
```

The static gates are **`pnpm lint`, `pnpm format:check`, `pnpm compile`** (all run in CI);
tsconfig is strict (`noUncheckedIndexedAccess`, `noUnusedLocals/Parameters`,
`verbatimModuleSyntax` → use `import type`). Run all three before considering a change
done. A husky pre-commit hook runs `lint-staged` (prettier + eslint --fix on staged
files) — don't bypass it with `--no-verify`.

Run a single test file or pattern:

```bash
pnpm test src/lib/engine/scheduler.test.ts   # one file
pnpm test -t "rate limit"                # by test name
```

Package manager is **pnpm** (lockfile present). `postinstall` runs `wxt prepare`, which
generates `.wxt/` (types, auto-imports) — needed before `tsc` works.

## Layout of src/

- `entrypoints/` — WXT entrypoints (background SW, content scripts, popup/options/sidepanel pages).
- `lib/` — shared core at the root: `models.ts` (domain types + state machine), `store.ts`
  (persistence), `messages.ts` (RPC protocol), `query-handler.ts` (SW query dispatch).
- `lib/api/` — network & auth: `uz-api`, `auth`, `auth-extractor`, `session-probe`, `net-rules`, `recaptcha`.
- `lib/engine/` — hunt machine (service-worker core): `orchestrator`, `scheduler`, `reserve`,
  `reserve-dispatch`, `cart-poller`, `bridge`, `tab-manager`, `job-factory`, `success`.
- `lib/format/` — pure parsers/formatters/matchers (`*-format`, `date`, `match-trip`, `seat-prefs`, …);
  depends on nothing but `models`.
- `lib/ui/` — browser-UI helpers: `anim`, `a11y`, `action-icon`, `icon-sync`, `sidepanel`,
  `onboarding`, `checkout`, `search-input`, `debug`, `logger`.
- `hooks/` — one file = one React hook. `components/` — one directory = one component.
- Tests are co-located with their module (`foo.ts` + `foo.test.ts` in the same directory).

## Architecture: the hybrid reserve

The single most important thing to understand is **why work is split across two JS
contexts**. Monitoring and reserving run in different places on purpose:

- **Monitoring → service worker.** `engine/orchestrator.ts` drives every job from `chrome.alarms`,
  calling the UZ API directly (read-only, fast). Requests need the SPA's `Origin`/`Referer`,
  but those are _forbidden headers_ `fetch` can't set — so `api/net-rules.ts` installs a
  `declarativeNetRequest` session rule that rewrites them, scoped to `app.uz.gov.ua` +
  `tabIds:[-1]` (SW-only requests; the real booking.uz tab is untouched).
- **Reserving → content script in the booking.uz tab.** The reserve must reuse the live
  SPA's reCAPTCHA token and same-origin auth, so it runs _in the page_. The SW dispatches
  it over an RPC port (`engine/bridge.ts`): `engine/reserve-dispatch.ts` (SW) → `content.ts` (page) →
  `engine/reserve.ts` (the actual flow). reCAPTCHA is **detected, never solved** — a challenge
  yields a `captcha` outcome, the SW focuses the tab, and a watcher auto-resumes when the
  user solves it.

### Auth flow (push + pull)

`api/auth-extractor.ts` (content script) heuristically scans booking.uz `localStorage` for the
JWT + `x-session-id` UUID + user id → posts it to the SW → `api/auth.ts` caches it in
`chrome.storage.session` and builds headers. That push alone misses tabs opened before
install/update (no live content script) and cleared SW caches — so the SW can also
**pull**: `api/session-probe.ts` reads the tab's `localStorage` on demand via
`chrome.scripting` and reconciles cache + badge with it (`resolveProbeDecision` is the
pure part). It runs on booking.uz navigations (incl. SPA history changes, i.e. login)
and on `authStatus` queries with an empty cache. The toolbar action icon mirrors
state by priority — amber = reservation awaiting payment, blue = active hunts,
green = session active, gray = no session — via `ui/action-icon.ts` (pure
`resolveActionState`) and `ui/icon-sync.ts` (recomputes on job/session changes,
arms a one-shot alarm at the nearest hold expiry; colored PNGs live in
`public/icon/states/`, regenerate with `scripts/generate-state-icons.py`).
`api/uz-api.ts` is context-agnostic: callers wire in a header provider + 401 handler
via `configureApi`. In the SW that provider reads the cached session (and
invalidates on 401); in the content script it reads the page session live.

### Job lifecycle

`HuntJob.state` in `models.ts` is the state machine: `idle → scheduled/hunting → reserving
→ reserved | paused | failed | cancelled`. The orchestrator owns transitions. Key invariants:

- **One global reserve at a time** — `reserveInFlight` lock in `engine/orchestrator.ts`; other jobs
  skip their tick while it's held.
- **Three modes:** `monitor` (one-shot alarm re-armed each tick, 5–30s), `scheduled` (a
  warmup alarm ~10s before `startAt`, then a self-driving `setTimeout` sprint loop at
  200–500ms — needs the popup's keep-alive port open to hold the SW awake), `native`
  (server-side monitor, TBD/disabled).
- On 429, `engine/scheduler.ts` computes backoff (doubled interval, honors `Retry-After`, enforces a
  fair-play minimum pause) and the job pauses until `pausedUntil`.

### Storage & UI

`store.ts` is the only persistence layer (`chrome.storage.local`: `jobs` map + capped per-job
`logs`). It exposes CRUD + a `subscribe` over `storage.onChanged`. The popup/options pages
read storage directly via the `hooks/use-store.ts` React hooks; they don't hold auth, so anything
needing the API goes through `messages.ts` (`QueryMessage`/`JobControlMessage`) to the SW's
`query-handler.ts`. UI is Ukrainian; coach types are `Л/К/П/С1/С2`.

## Conventions that recur

- **Pure core, injected effects.** Policy/parsing live in pure exported functions; side
  effects (clock, sleep, DOM captcha check, event emit, alarm calls) are injected. See
  `engine/scheduler.ts` (pure helpers vs `schedule*`), `engine/cart-poller.ts` (`now`/`sleep`),
  `engine/reserve.ts` (`emit`/`isCaptchaPresent`/`uuid`), `api/uz-api.ts` (pure `parse*` split from
  `fetch`). Follow this when adding logic — it's what keeps things unit-testable.
- **TBD endpoints throw `NotDiscoveredError`.** Several API shapes await a fresh discovery
  HAR (see `docs/endpoints.md`). All network code is isolated in `api/uz-api.ts`; unconfirmed
  endpoints throw, callers feature-detect, and the UI degrades to manual entry. When an
  endpoint is confirmed, change only `api/uz-api.ts`.
- **Reservation POSTs never auto-retry** (`retries: 0`); the encrypted `wagon_id` can't be
  precomputed — it's fetched fresh and POSTed verbatim.
- WXT auto-imports `defineBackground`/`defineContentScript`; `browser` is imported from
  `wxt/browser`. Path alias `@/` → `src/`.

## Component & UI conventions

These are hard rules for anything under `src/components/` and the UI entrypoints
(popup/options/sidepanel/onboarding). They exist so the open-source codebase stays
reviewable — follow them even when a shortcut looks easier.

- **One directory = one component.** `ComponentName/index.tsx` (PascalCase). A
  component's directory may also hold its `types.ts`, `constants.ts`, and private
  sub-components. No multi-export files: the only allowed barrels are `index.ts`
  re-exports (`ui/`, `skeleton/`, `donate/`, `onboarding/screens/`) and `icons.tsx`.
- **Hooks live in `src/hooks/`.** One file = one hook, file name = hook name in
  kebab-case (`use-orders.ts`, `use-confetti.ts`, `use-app-navigation.ts`).
  Fetching, storage subscriptions, timers, GSAP, and any stateful logic go
  into a hook; the component stays thin — hook + render. Pure (non-hook)
  helpers live in `src/lib/` (`ui/checkout.ts`, `ui/search-input.ts`,
  `format/match-trip.ts`, formatters in `format/*-format.ts`/`format/date.ts`). Exception: wizard-local
  hooks may live next to their component (`NewJobForm/use-*.ts`).
- **Types/enums/constants next to their owner.** Component-owned types go in the
  component's `types.ts` (`SelectOption`, `ConfirmTone`, `Berth`/`SeatSelection`/
  `NewJobFormState` in `NewJobForm/types.ts`). Never import domain types from a
  component's `.tsx` — import from the `types.ts`.
- **Named handlers.** Non-trivial JSX handlers are named functions in the component
  body (or a hook), not inline arrows. Inline `() => setX(true)` for trivial state
  toggles is fine.
- **No duplicated logic across files.** If two components need the same behavior
  (handler, formatter, note text), it moves to `src/lib/` — copy-paste between
  components is how `openCheckout`/`noteForCode` rotted.
- **Comments explain why, not what.** No narrating comments (`// render the list`),
  no commented-out code, no decorative section banners. AI-generated slop comments
  get deleted on sight; a good comment answers "why is this non-obvious thing like
  this" (see `FloatingPanel`, `use-job-control.ts`).
- **Styling is Tailwind classes in JSX.** No raw `style={{}}` objects for static
  styles; inline `style` only for dynamic values (positioning, GSAP-driven props).
  Content-script UI is the exception that proves the rule: it can't rely on the
  host page's styles, so `PaymentCelebrateBanner/celebrate.css` imports Tailwind
  utilities with the `uz:` prefix (no preflight) — keep that prefix on every class
  there so host-page collisions are impossible.
- **UI text is Ukrainian**; code, comments, and identifiers are English. Coach
  types are `Л/К/П/С1/С2`.

### Bad practices — do not reintroduce

Historical anti-patterns removed in the 2026 UI refactor; reviewers should reject
these on sight:

- **God components / god hooks** — many unrelated exports in one file (the old
  `ui.tsx` with 8 primitives, `mockScreens.tsx` with 7 screens, a 16-`useState`
  form hook). Split by responsibility instead.
- **Business logic in components** — fetch loops, retry/restart flows, and parsing
  inline in `.tsx` (the old `JobDetails` restart flow, `DatePicker` calendar math).
  That's what hooks and pure lib functions are for.
- **Domain types exported from component files** (`SeatSelection` used to live in
  `TrainPicker.tsx` and be imported by a hook) — wrong dependency direction.
- **Raw `style={{}}` instead of Tailwind** (the old `PaymentCelebrateBanner`).
- **Duplicated handlers/formatters across components** (`openCheckout`,
  `noteForCode`, the station-input `onChange`) — extract to `src/lib/` once.
- **Comments that paraphrase code**, ALL-CAPS "cool" comments, and dead
  `eslint-disable` directives without a why-comment.
- **Bypassing the gates** — committing with red `lint`/`format:check`/`compile`,
  or `--no-verify` around the pre-commit hook.

## Testing

Vitest + `WxtVitest()` plugin → in-memory `fakeBrowser` (real `chrome.storage`/`alarms`
behavior) in a `happy-dom` env. Tests typically `vi.mock('@/lib/api/auth')` and
`vi.mock('@/lib/api/uz-api')` while using the real `fakeBrowser` storage, and assert against `fixtures/*.json` (extracted
from `booking.uz.gov.ua.har`). Orchestrator/reserve modules keep module-level runtime state
(`reserveInFlight`, `sprintTimers`) — reset it with `resetOrchestratorState()` in `beforeEach`.
