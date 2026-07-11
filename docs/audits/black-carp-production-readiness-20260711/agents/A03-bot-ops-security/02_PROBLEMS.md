# A03 — Problems

### P1-A03-01: Master notification depends on client Telegram action

- **Promise:** the master is notified immediately after website submit.
- **Reality:** submit returns `masterNotified:false`; notification occurs only in `/start <code>`.
- **Evidence:** `server.js:109-120`, `server.js:209-282`; target `docs/crm-mvp-technical-spec.md:153-209`.
- **Effect:** valid leads are invisible if the client closes the site or refuses Telegram.
- **Cause:** bot still owns the old client-link handoff.
- **Status:** confirmed.

### P1-A03-02: Webhook authentication fails open

- **Promise:** only Telegram may submit webhook updates.
- **Reality:** when `WEBHOOK_SECRET` is empty/missing, all bodies are accepted.
- **Evidence:** `server.js:127-134`; `.env.example:5` is documentation, not enforcement.
- **Effect:** a deployment configuration mistake enables forged messages/callback attempts and database/log abuse.
- **Cause:** security-critical configuration is optional at runtime.
- **Status:** confirmed.

### P1-A03-03: Client receives false success when forwarding a comment fails

- **Promise:** `Комментарий передан мастеру` means delivery succeeded.
- **Reality:** `notifyMasterText()` result is ignored and the bot always confirms success.
- **Evidence:** `server.js:314-323`, `server.js:407-413`.
- **Effect:** client information can be silently lost.
- **Cause:** transport outcome is not part of the user-visible state transition.
- **Status:** confirmed.

### P1-A03-04: Notification failure has no durable retry path

- **Promise:** transient Telegram downtime does not permanently hide a lead.
- **Reality:** an error string is stored, but there is no outbox, retry schedule, worker, or manual resend API.
- **Evidence:** `server.js:262-280`; no retry entrypoint in `server.js` or package scripts.
- **Effect:** a temporary external outage becomes permanent operational data loss.
- **Cause:** synchronous best-effort delivery is the only notification mechanism.
- **Status:** confirmed.

### P1-A03-05: Telegram update idempotency races with side effects

- **Promise:** retries of the same `update_id` execute once.
- **Reality:** code checks for an update, performs side effects, then inserts the id; concurrent retries can both execute before one insert fails.
- **Evidence:** `server.js:136-160`; callback writes happen at `server.js:353-356`.
- **Effect:** duplicated history/status actions and 500 responses can trigger further Telegram retries.
- **Cause:** dedupe reservation and side effects are not one transaction/state machine.
- **Status:** confirmed.

### P1-A03-06: Release pipeline does not test the application

- **Promise:** main deploys only a verified site, API, CRM and bot.
- **Reality:** `npm test` intentionally exits 1, while CI merely checks that files exist; deploy is a separate main-push job without a validation dependency.
- **Evidence:** `package.json:9-13`; `.github/workflows/validate.yml:10-23`; `.github/workflows/deploy.yml:13-26`.
- **Effect:** syntax, behavior, auth, migrations and UI regressions can deploy automatically.
- **Cause:** static-page CI remained after the project became a stateful backend.
- **Status:** confirmed.

### P2-A03-01: Master authorization conflates chat and user identifiers

- **Promise:** authorization uses explicit master Telegram user ids.
- **Reality:** callback access checks `callback.from.id` against `MASTER_CHAT_IDS`.
- **Evidence:** `server.js:326-330`, `server.js:732-736`; target requires `MASTER_TELEGRAM_IDS`.
- **Effect:** group/channel chat configuration can break or misconfigure authorization.
- **Cause:** notification destinations and identities share one setting.
- **Status:** confirmed.

### P2-A03-02: Bot transport and health are operationally weak

- **Promise:** external calls terminate predictably and health reflects readiness.
- **Reality:** normal Bot API fetch has no timeout; `/health` does not check DB/config; there is no graceful shutdown or structured readiness response.
- **Evidence:** `server.js:29-31`, `server.js:666-684`, `server.js:204-207`.
- **Effect:** hung requests and false-green health can conceal outage conditions.
- **Cause:** minimal prototype operations layer.
- **Status:** confirmed.

### P2-A03-03: Runtime compatibility is unspecified

- **Promise:** production install starts reproducibly.
- **Reality:** the server depends on experimental built-in `node:sqlite`, but package metadata and deploy docs do not pin a Node version.
- **Evidence:** `server.js:6`; `package.json`; runtime warning on Node 22.18.
- **Effect:** older or future incompatible Node runtimes can fail at startup or change behavior.
- **Cause:** runtime dependency is implicit.
- **Status:** confirmed.
