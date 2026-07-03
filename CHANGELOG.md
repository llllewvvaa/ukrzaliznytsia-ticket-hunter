# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-07-03

Initial public release.

### Added

- **Background monitoring** of `booking.uz.gov.ua` from the service worker —
  read-only API polling with deliberate fair-play throttles (poll floors, 429 backoff).
- **In-page reserve flow** on the booking.uz tab, reusing the live SPA's reCAPTCHA
  token and session. reCAPTCHA is **detected, never solved** — the user solves it in
  the tab and hunting auto-resumes.
- **Three hunt modes:** `monitor` (re-armed alarm, 5–30 s), `scheduled` (pre-sale
  sprint that starts at the sale-open time), and `native` (server-side, disabled/TBD).
- **Seat control:** seat preferences (berth, adjacent, avoid-toilet, air-conditioned)
  and a manual wagon-map seat picker.
- **"My tickets"** boarding-pass view for active and archived orders, with PDF links.
- Passenger and date pickers, station autocomplete, timetable-based train picker.
- Onboarding flow; fully **Ukrainian** UI.
- Chrome **Manifest V3** build (WXT + React 19 + TypeScript).

### Notes

- The extension **never pays** — you complete payment manually within UZ's ~15-minute hold.
- Not affiliated with Ukrzaliznytsia. Personal use only.

[0.1.0]: https://github.com/llllewvvaa/ukrzaliznytsia-ticket-hunter/releases/tag/v0.1.0
