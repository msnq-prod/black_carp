# A03 — Solution Plan

## Recommended direction

1. Notify the master after the booking transaction commits. Use a WebApp button to `/crm?request=<publicCode>`; client Telegram is optional.
2. Persist each delivery in a notification outbox with attempts, next-attempt time, last error and terminal sent state. Retry transient failures with bounded exponential backoff; expose manual retry in CRM.
3. Separate `MASTER_CHAT_IDS` (destinations) from `MASTER_TELEGRAM_IDS` (authorization identities).
4. In production, refuse webhook processing when `WEBHOOK_SECRET` is unset. Reserve an `update_id` before side effects and complete it transactionally/idempotently.
5. Add timeout/abort behavior to all Telegram requests and make client/bot messages reflect actual delivery outcome.
6. Add request ids, structured log events, readiness checks, graceful shutdown and safe error responses.
7. Pin supported Node version and add real test scripts. CI installs with `npm ci`, runs syntax/tests/media checks and gates deploy on validation.
8. Document backup, migration, webhook setup, smoke, rollback and recovery; do not claim production verification without real staging/live evidence.

## Regression tests

- Immediate master notification through a local Telegram stub.
- Telegram failure still returns saved booking and creates retryable outbox row.
- Retry succeeds once and does not duplicate activity.
- Forged/missing webhook secret, duplicate update and unauthorized callback.
- Client comment failure produces honest retry guidance.
- Health/readiness with unavailable DB/config.
- Clean checkout `npm ci && npm test` on the pinned Node version.

## Rollout risk

- Avoid duplicate notifications during migration: backfill no pending outbox rows for old bookings unless explicitly requested.
- Telegram WebApp requires HTTPS and a configured bot domain in production; keep local verification on signed test initData and stubbed Bot API.
