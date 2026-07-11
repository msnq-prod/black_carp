# A02 — CRM Backend And WebApp Analysis

## Inspected

- full `server.js` API, schema, persistence and static routes;
- `editor-server.js`, `editor/`, legacy `*_v2` files;
- complete CRM technical specification and acceptance criteria;
- local health/submit/idempotency smoke requests;
- runtime `/crm` capture.

## Actual implementation

- Public API exposes booking submit/status and Telegram webhook only (`server.js:29-188`).
- SQLite contains `clients`, `booking_requests`, `booking_attachments`, `status_history`, `telegram_updates` (`server.js:573-650`).
- There is no `/api/crm/*`, no Telegram initData verification, no CRM data fields/tables, and no `crm/` frontend.
- `/crm` returns `Cannot GET /crm` (`screenshots/05-crm-missing.jpg`).
- The separate visual editor can upload arbitrary files and overwrite `index.html` without authentication if started (`editor-server.js:10-61`). It is not the requested CRM.

## Data and state behavior

- Attachments are decoded and written before the booking database row is created (`server.js:55-91`, `server.js:360-382`).
- Booking creation, attachment rows, history, and final status update are separate non-transactional operations (`server.js:55-120`).
- `status_history.to_status` is also used for events such as `client_comment` and `master_notify_failed`, even when the booking status is not changed (`server.js:273-280`, `server.js:321`).
- Schema installation uses only `CREATE TABLE IF NOT EXISTS`; it has no versioned migration path for an existing SQLite file (`server.js:21-24`, `server.js:573-650`).

## Runtime evidence

- `GET /health` — 200 `{"ok":true}`.
- Valid legacy submit — 200, status implicit `awaiting_client_start`, `masterNotified:false`.
- Duplicate idempotency key — 200 with the original request, but response shape differs and omits notification/status fields.
- Invalid empty payload — 400 `consent_required`.

## Positive evidence

- SQL values use prepared statements.
- Public booking codes and ids use cryptographic randomness.
- Foreign keys and WAL are enabled.
- Telegram update ids and booking idempotency keys have unique constraints.
