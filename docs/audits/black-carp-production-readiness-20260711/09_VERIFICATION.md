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

## Final P1 fix pass — 2026-07-12

### Pass

- `npm run check`.
- `npm test`: 12/12, including durable client comments, Telegram rebind rejection, explicit CRM allowlist, pre-parse rate/auth guards, trusted proxy buckets, outbox lease recovery and schema v1→v2/future-version rejection.
- `npm audit --omit=dev`: zero known advisories.
- `docker compose ... config --quiet`.
- workflow/compose YAML parse and shell/Node syntax checks.
- backup → checksum → archive extraction → SQLite integrity → attachment readback smoke.
- `git diff --check`.

### Pending external evidence

- final Browser rerun is blocked because the managed sandbox denies localhost listeners and the approval quota is exhausted;
- local Docker daemon is stopped, so image build/run must be proven by the new GitHub `Validate` job;
- production host deploy/rollback scripts, Caddy network, cron/off-host destination and rotated Telegram secrets are not installed in this local change;
- physical Telegram WebView checks on iOS/Android and live webhook smoke remain deployment gates.

## Final release-hardening pass — 2026-07-15

### Pass

- `npm run check`.
- `npm test`: 13/13, including protected deploy readiness, webhook URL/secret registration, stale upload invalidation, CRM refresh/focus guards and production release checks.
- `npm audit --omit=dev`: zero known advisories.
- `docker compose ... config --quiet`, YAML and shell syntax, `git diff --check`.
- Browser smoke on fresh local server: public booking flow, body-side invariant, success response, CRM list/card, external refresh, note save and focus restoration at mobile viewport.
- Docker image build and runtime smoke: health 200, embedded revision/OCI label match, non-root UID 1000, restart recovery and `/`/`/crm` availability.

### Pending external evidence

- GitHub Validate still needs to run on the branch; local Docker image/runtime smoke is green.
- Host deploy/rollback/backup scripts, Caddy network, off-host destination and rotated Telegram secrets are not installed in this local change.
- Physical Telegram WebView checks on iOS/Android remain deployment gates.
