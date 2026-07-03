# Security Policy

This extension reads your **live booking.uz session** (a Bearer token + `x-session-id`)
from the page and caches it in `chrome.storage.session` to call UZ's own API on your
behalf. Nothing is ever sent anywhere except `app.uz.gov.ua` / `booking.uz.gov.ua`. Treat
that session data as a credential.

## Reporting a vulnerability

**Please do not open a public issue for security problems.** Use GitHub's private
vulnerability reporting on this repository: **Security → Report a vulnerability**. We'll
respond as soon as we reasonably can.

## Please never attach captured data

When reporting a bug, **do not attach** `.har` files, page snapshots, or raw API responses
— they contain live JWTs, session ids, and passenger PII. Redact tokens and personal data
first. The repository's `.gitignore` blocks `*.har` and page snapshots for the same reason.

## Notes

- The extension never automates payment and never attempts to bypass reCAPTCHA — a human
  solves it in the tab.
- Fair-play throttles (poll floors, 429 backoff) are intentional; please keep them intact.
