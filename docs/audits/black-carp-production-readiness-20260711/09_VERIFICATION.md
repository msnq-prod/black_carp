# Baseline Verification

## Pass

- `node --check server.js`.
- `node --check script.js`.
- server starts on Node 22.18 with an experimental SQLite warning.
- `GET /health` returns 200.
- legacy valid submit and duplicate replay return 200.
- invalid empty submit returns 400.
- `npm audit --omit=dev --json`: zero known dependency advisories on 2026-07-11.
- `git diff --check`.

## Fail / contradiction

- `npm test`: intentional failure, no tests.
- `/crm`: 404.
- gallery first item: missing media.
- `/#/booking`: renders Home on fresh load.
- desktop: 520px phone shell.

## Visual evidence

- `screenshots/01-mobile-home.jpg`.
- `screenshots/02-mobile-works.jpg`.
- `screenshots/03-booking-start.jpg`.
- `screenshots/04-desktop-home.jpg`.
- `screenshots/05-crm-missing.jpg`.

## Skipped / residual

- no real Telegram credentials or production calls;
- no production DB migration/backup inspection;
- no physical-device or screen-reader verification;
- no live deploy.
