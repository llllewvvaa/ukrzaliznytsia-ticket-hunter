# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.5] - 2026-07-19

### Changed

- **Donation celebration flow** — removed the one-time donation card from the extension popup and replaced it with a spectacular native-looking celebration banner directly on the `booking.uz.gov.ua/payment` page. The celebration features an immersive GSAP confetti explosion and appears right when you need to pay for a reserved ticket.

## [1.1.0] - 2026-07-19

### Added

- **Session detection without page reload** — the service worker can now pull the
  booking.uz session straight from the tab (`chrome.scripting`) on SPA navigations
  and when the popup asks for auth status. Logging in (or out) shows up in the popup
  and on the toolbar icon immediately, even in tabs opened before install/update.
  Adds the `scripting` permission.
- **State-aware toolbar icon** — amber when a reservation awaits payment, blue while
  hunts are running, green when the session is active, gray when there is none.
  Refreshes on job and session changes; a one-shot alarm drops the amber state once
  the payment hold expires. (Colored icons pregenerated in `public/icon/states/`.)
- **Sale-open auto-fill** for scheduled hunts: the start time defaults to 20 days
  before the trip date at 08:00 and stays editable — manual edits are never
  overwritten.
- **Custom date + time picker** — the existing calendar gains scrollable
  hour/minute columns (Chrome-style side layout), replacing the native
  `datetime-local` input for the sale-open time.

## [1.0.0] - 2026-07-03

First stable release. Internal refactor — no user-facing behaviour change:
extracted shared hooks (`useJobControl`, `useSegmentIndicator`,
`useDebouncedSearch`), centralised date helpers, and split the reserve wizard
(`NewJobForm`) into per-step components backed by a `useNewJobForm` state hook.

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

[1.1.5]: https://github.com/llllewvvaa/ukrzaliznytsia-ticket-hunter/releases/tag/v1.1.5
[1.1.0]: https://github.com/llllewvvaa/ukrzaliznytsia-ticket-hunter/releases/tag/v1.1.0
[1.0.0]: https://github.com/llllewvvaa/ukrzaliznytsia-ticket-hunter/releases/tag/v1.0.0
[0.1.0]: https://github.com/llllewvvaa/ukrzaliznytsia-ticket-hunter/releases/tag/v0.1.0
