<div align="center">

<img src="docs/hero.png" alt="UZ Ticket Hunter" width="860">

&nbsp;

![Chrome MV3](https://img.shields.io/badge/Chrome-MV3-4285F4?logo=googlechrome&logoColor=white)
![Built with WXT + React 19](https://img.shields.io/badge/built%20with-WXT%20%2B%20React%2019-0EA5E9)
![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![License: MIT](https://img.shields.io/badge/license-MIT-10B981)

</div>

A Chrome (Manifest V3) browser extension that **monitors and reserves** tickets on
[booking.uz.gov.ua](https://booking.uz.gov.ua/). You configure a route + criteria; the
extension watches availability in the background, instantly reserves the first matching
option, then notifies you and opens the checkout — **you complete the payment manually**.

Built with [WXT](https://wxt.dev) + React + TypeScript.

> ⚠️ **Disclaimer — personal use only.** This is an unofficial, independent tool intended
> to help an individual buy tickets for personal travel. It is **not affiliated with,
> endorsed by, or connected to Ukrzaliznytsia (Ukrainian Railways)** in any way. It does not
> store card data, does not pay automatically, and does not attempt to bypass reCAPTCHA (a
> human solves it in the tab). Respect Ukrzaliznytsia's Terms of Service and don't use it for
> resale or at abusive request rates. Polling intervals are deliberately throttled. Provided
> "as is", without warranty — **use at your own risk**.

## Screenshots

<img src="docs/showcase.png" alt="UZ Ticket Hunter — hunts list, pre-sale train picker, and saved tickets" width="880">

> UI is in Ukrainian; coach types use UZ's own labels (Л/К/П/С1/С2). Data shown is fictitious.

## Architecture (hybrid)

- **Monitoring** — the service worker calls the real API at `https://app.uz.gov.ua/api`
  directly (read-only, fast).
- **Reserving** — performed inside a **content script on the booking.uz tab**, so the
  live SPA's reCAPTCHA token and authorization are reused.
- **Auth** — a content script extracts the Bearer token + `x-session-id` + user id from the
  page and caches them in `chrome.storage.session`.
- **Origin** — a `declarativeNetRequest` session rule rewrites the `Origin`/`Referer`
  (forbidden headers `fetch` can't set) on the service worker's own requests to
  `app.uz.gov.ua`, so they look same-site like the SPA. It's scoped to the API host and
  `tabIds:[-1]` (SW only), and does **not** touch the booking.uz tab or bypass reCAPTCHA.

See [`docs/endpoints.md`](docs/endpoints.md) for the discovered API surface and the
remaining TBD items. Sample API responses live in [`fixtures/`](fixtures).

## Project layout

```
src/
  entrypoints/
    background.ts        # service worker: orchestrator + reserve dispatch + queries
    content.ts           # booking.uz: auth-extractor + reserve-executor (RPC)
    offscreen/           # hidden page that plays the alert sound
    popup/               # primary UI: job list + new-hunt form + details (no nav away)
    options/             # full-screen version of the same management UI
  components/            # shared React UI
    ui.tsx               #   local Tailwind primitives (Button/Input/Chip/Toggle/…)
    JobCard.tsx NewJobForm.tsx JobDetails.tsx StationCombobox.tsx
    PassengerPicker.tsx AuthIndicator.tsx EmptyState.tsx OrdersView.tsx
  lib/
    models.ts            # domain types
    store.ts             # chrome.storage.local CRUD + reactive subscribe
    auth.ts uz-api.ts    # session cache + typed UZ API client
    net-rules.ts         # DNR rule: rewrite Origin/Referer for SW API requests
    bridge.ts            # SW↔content-script RPC + keep-alive port
    tab-manager.ts       # ensure/focus the booking.uz tab
    scheduler.ts         # alarm timing + 429 backoff (pure helpers)
    orchestrator.ts      # hunt loop: match → reserving → dispatch
    reserve.ts           # in-page reserve flow (seats → hold → order → cart)
    cart-poller.ts       # cart queue polling (respects retry_in)
    reserve-dispatch.ts  # SW glue: tab RPC → outcome → success/captcha/backoff
    success.ts           # notification + sound + checkout tab
    recaptcha.ts         # reCAPTCHA challenge detection (no auto-solve)
    messages.ts          # page↔SW control + query contracts
    job-factory.ts       # form → HuntJob validation
    use-store.ts job-format.ts order-format.ts logger.ts
  assets/tailwind.css
public/sounds/alert.wav  # success chime
public/icon/             # extension + notification icons
fixtures/                # anonymized JSON samples (used by tests only)
docs/endpoints.md        # API discovery notes
```

## Prerequisites

- Node.js ≥ 20 (developed on v24)
- pnpm ≥ 9 (developed on v10)

## Getting started

```bash
pnpm install        # installs deps and runs `wxt prepare`
pnpm dev            # start the dev build with HMR (Chrome)
```

`pnpm dev` launches WXT's dev server and writes the unpacked extension to
`.output/chrome-mv3`.

### Load it in Chrome (developer mode)

1. Open `chrome://extensions`.
2. Toggle **Developer mode** (top-right).
3. Click **Load unpacked** and select `.output/chrome-mv3`.
4. Log in at [booking.uz.gov.ua](https://booking.uz.gov.ua/) so the extension can read your
   session, then open the extension popup to create a hunt.

> `pnpm dev` keeps the build up to date; just reload the extension (or the page) after
> changes. For a production bundle use `pnpm build` (and `pnpm zip` to package it).

### Using the extension

1. **New hunt** — open the popup and click *Нове полювання* (everything happens inside the
   popup; the Options page offers the same flow on a full screen). Pick from/to stations, a
   date, optional preferred trains and coach types (`Л/К/П/С1/С2`), passengers, and the
   `bedding` service.
2. **Mode**:
   - **Monitor** — polls every 5–30 s in the background.
   - **Scheduled** — waits idle until your exact start time, then sprints (200–500 ms) —
     ideal for the 09:00 sales opening 45 days out. Keep the popup open to hold the worker
     awake during the sprint.
   - **Native** — reserved for a server-side UZ monitor; disabled until that endpoint is
     confirmed during discovery.
3. When a match is found the extension reserves it in your booking.uz tab. If reCAPTCHA
   appears, the tab is surfaced — **solve it** and the hunt resumes automatically.
4. On success you get a loud notification + the checkout tab; **complete payment within the
   ~15-minute hold.** The card and details show **«Заброньовано на HH:MM»** — the exact time
   the held seats expire. Manage/inspect hunts (status, attempts, logs) from the popup/Options.
5. **Мої квитки** — a second popup tab lists your UZ orders: active/upcoming
   (`GET /api/v4/orders-with-routes`) and a paginated archive
   (`GET /api/v2/orders/archived?page=`), with per-ticket seat, price and PDF links.

> Some lookups (station/train search, saved passengers) call live endpoints; if you're not
> logged in or an endpoint isn't confirmed yet, the form falls back to manual id entry.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Dev build + HMR for Chrome |
| `pnpm build` | Production build → `.output/chrome-mv3` |
| `pnpm zip` | Zip the production build for the store |
| `pnpm compile` | `wxt prepare` + `tsc --noEmit` (type-check) |
| `pnpm test` | Run unit tests (Vitest + WXT `fakeBrowser`) |
| `pnpm test:watch` | Vitest in watch mode |

## Status

Implemented incrementally per the delivery plan:

- [x] **Step 1** — API/auth/reCAPTCHA discovery → `docs/endpoints.md` + `fixtures/`
- [x] **Step 2** — WXT MV3 scaffold + domain model + reactive storage layer
- [x] **Step 3** — auth bridge, UZ API client, SW↔CS RPC, tab manager
- [x] **Step 4** — hunt orchestrator (monitor / scheduled / native)
- [x] **Step 5** — reserve executor (reCAPTCHA-aware) + success flow
- [x] **Step 6** — popup + options UI

Confirmed live since: station search, trip search, **seat hold**
(`POST /api/trips/{id}/seats/hold`), the ready-cart `expire_at` hold deadline, and the
**orders** endpoints behind the «Мої квитки» tab. Still **TBD** pending a fresh authenticated
HAR: wagons-by-class / seats (encrypted `wagon_id` source), native monitoring, and the exact
auth token key — see `docs/endpoints.md`. The networking layer is isolated in `lib/uz-api.ts`
so those can be filled in without touching callers, and the UI degrades to manual entry until then.

> The raw discovery captures (`*.har`, page snapshots) are intentionally **not** committed —
> they contain live JWTs, session ids and passenger PII. The samples in `fixtures/` are
> anonymized and used only by the tests.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). In short: `pnpm compile` (strict `tsc`) and
`pnpm test` are the only gates; never commit `.har` files, page snapshots, or real personal
data. Architecture and conventions live in [`CLAUDE.md`](CLAUDE.md).

## Security

Please report vulnerabilities privately — see [`SECURITY.md`](SECURITY.md). Don't attach
captured session data or HAR files to issues.

## License

[MIT](LICENSE) © UZ Ticket Hunter contributors.
