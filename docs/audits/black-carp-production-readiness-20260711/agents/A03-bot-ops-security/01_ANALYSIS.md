# A03 — Bot, Operations And Security Analysis

## Inspected

- Telegram webhook, `/start`, client messages, callbacks and Bot API transport in `server.js`;
- environment template, package scripts, validation/deploy workflows;
- Telegram architecture/setup and Caddy deploy documentation;
- local syntax, API smoke, dependency audit and test command.

## Current bot flow

1. Website creates a request and sets `awaiting_client_start` (`server.js:33-120`).
2. Master is not notified at submit.
3. Only `/start <publicCode>` links a Telegram client and calls `notifyMaster()` (`server.js:209-282`).
4. Master handles the request through inline callback buttons, not CRM (`server.js:326-405`).
5. Bot failures are stored on the booking after `/start`, but there is no retry worker/outbox.

## Security boundaries

- Webhook secret validation is conditional: missing configuration disables it (`server.js:127-134`).
- Callback authorization reuses `MASTER_CHAT_IDS` as Telegram user ids (`server.js:326-330`, `server.js:732-736`).
- Public submit has a 25MB JSON cap but no request-rate control (`server.js:26`, `server.js:484-493`).
- Direct Bot API fetch has no abort timeout; only the manual-IP transport does (`server.js:666-721`).

## Release evidence

- `node --check server.js` and `node --check script.js` pass.
- `npm test` fails by design (`package.json:10`).
- CI only checks four paths exist (`.github/workflows/validate.yml:18-23`).
- `npm audit --omit=dev --json` reported zero known vulnerabilities for the current lockfile.
- Runtime uses Node 22.18 and emits an experimental `node:sqlite` warning; package/docs do not pin a compatible Node runtime.
