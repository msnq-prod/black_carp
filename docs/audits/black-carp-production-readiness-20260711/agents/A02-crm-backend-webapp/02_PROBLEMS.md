# A02 — Problems

### P1-A02-01: The requested CRM does not exist

- **Promise:** protected master WebApp with list, detail, status, notes, scheduling, history and attachment access.
- **Reality:** no CRM route, frontend, API, initData verification, contact fields, notes, schedule, or activity schema exists.
- **Evidence:** routes `server.js:29-202`; schema `server.js:573-650`; screenshot `screenshots/05-crm-missing.jpg`; target `docs/crm-mvp-technical-spec.md:216-565`.
- **Effect:** the main master workflow in the user objective is impossible.
- **Cause:** technical specification was written but not implemented.
- **Status:** confirmed.

### P1-A02-02: Booking persistence is not atomic

- **Promise:** a successful booking is complete; a failed booking leaves no partial data/files.
- **Reality:** files, booking row, attachment rows, history and status update are separate writes without a transaction or compensating cleanup.
- **Evidence:** `server.js:55-120`, `server.js:360-382`.
- **Effect:** disk or database failures can leave orphan files, partial bookings, missing history, or misleading API errors after durable writes.
- **Cause:** request handler directly coordinates persistence without a transaction boundary.
- **Status:** confirmed.

### P1-A02-03: Attachments are publicly served

- **Promise:** CRM attachments require an authorized master.
- **Reality:** all upload paths are exposed through unauthenticated `express.static`.
- **Evidence:** `server.js:190-192`; stored paths include request id and deterministic filenames (`server.js:363-380`).
- **Effect:** anyone obtaining or guessing a URL can read sensitive sketches/references.
- **Cause:** file storage and authorization boundaries are coupled to public static hosting.
- **Status:** confirmed.

### P1-A02-04: Legacy editor is an unauthenticated site-overwrite service

- **Promise:** administration is authenticated and production-safe.
- **Reality:** `npm run editor` starts upload and save endpoints with no authentication, type/size policy, CSRF protection, or loopback-only bind; `/api/save` replaces `index.html` from client HTML.
- **Evidence:** `package.json:9-13`; `editor-server.js:10-61`, `editor-server.js:90-98`.
- **Effect:** accidental network exposure allows arbitrary media upload and complete public-site replacement.
- **Cause:** a local prototype editor has no explicit trust boundary.
- **Status:** confirmed.

### P1-A02-05: Status and activity have conflicting meanings

- **Promise:** one canonical request status plus an immutable activity history.
- **Reality:** `status_history.to_status` mixes real statuses with events (`client_comment`, `master_notify_failed`); callbacks permit any transition from any current status.
- **Evidence:** `server.js:273-280`, `server.js:321`, `server.js:326-356`, `server.js:625-633`.
- **Effect:** CRM filters, timelines, retries and state restoration cannot reliably interpret history.
- **Cause:** no explicit state machine or separate activity event model.
- **Status:** confirmed.

### P1-A02-06: Existing databases cannot be safely evolved

- **Promise:** production upgrade adds CRM fields/tables without deleting data.
- **Reality:** startup only executes idempotent create statements; `CREATE TABLE IF NOT EXISTS` never adds columns to an existing table.
- **Evidence:** `server.js:21-24`, `server.js:573-650`.
- **Effect:** deploying CRM code against the existing SQLite file would fail or silently lack required columns.
- **Cause:** no schema version/migration runner.
- **Status:** confirmed.

### P2-A02-01: Idempotent responses do not preserve the public contract

- **Promise:** replay of a booking request returns the same semantic result.
- **Reality:** duplicate response omits `status`/`masterNotified` and has a legacy `telegramUrl`; check-then-insert is not atomic under concurrent requests.
- **Evidence:** `server.js:41-52`, `server.js:114-120`.
- **Effect:** clients cannot render a deterministic success state, and concurrent retries may return 500 on the unique constraint.
- **Cause:** idempotency is implemented as a preflight lookup rather than a transactional result record.
- **Status:** confirmed.
