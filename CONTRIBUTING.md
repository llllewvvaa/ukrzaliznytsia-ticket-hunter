# Contributing

Thanks for your interest! This is a small personal-use tool — issues and PRs are welcome.

## Setup

```bash
pnpm install     # runs `wxt prepare` via postinstall
pnpm dev         # dev build + HMR → .output/chrome-mv3
```

Load the unpacked extension from `.output/chrome-mv3` at `chrome://extensions` (Developer
mode). Node ≥ 20 and pnpm ≥ 9.

## The gate

There is no ESLint/Prettier — **`pnpm compile` (strict `tsc`) and `pnpm test` are the only
checks**, and CI runs both plus `pnpm build`. Run them before opening a PR:

```bash
pnpm compile     # wxt prepare + tsc --noEmit
pnpm test        # vitest
pnpm build       # production bundle
```

## Conventions

- Architecture and house style live in [`CLAUDE.md`](CLAUDE.md): pure core + injected
  effects (clock/sleep/DOM/network are parameters), pure `parse*` split from `fetch`,
  unconfirmed endpoints throw `NotDiscoveredError` and the UI degrades to manual entry.
- UI copy is Ukrainian; icons come from `react-icons/md` — **no native emoji**.
- Keep the fair-play throttles (poll floors, 429 backoff). reCAPTCHA is **detected, never
  solved**.

## Never commit secrets or PII

- **No `.har` files, page snapshots, or raw API captures** — they contain live JWTs,
  session ids, and passenger PII. `.gitignore` blocks them; keep it that way.
- Test fixtures in `fixtures/` must use **anonymized** data (fake names, emails, phones).
- Don't paste tokens or personal data into issues, commits, or code comments.
