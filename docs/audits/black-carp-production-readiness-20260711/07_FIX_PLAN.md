# Fix Plan

## Cluster 1 — Domain and persistence foundation

- versioned migration runner;
- canonical statuses/transitions/activity;
- contact/schedule/notes/outbox schema;
- app construction separated from process startup;
- atomic booking/idempotency/file cleanup.

## Cluster 2 — Secure CRM backend

- Telegram initData verification/freshness/master allowlist;
- CRM me/list/detail/status/note/schedule APIs;
- protected attachment streaming;
- validation, cursor/search and conflict responses.

## Cluster 3 — Bot delivery

- immediate WebApp notification after submit;
- persisted retry/outbox/manual retry;
- separate chat/user ids;
- webhook fail-closed/dedupe reservation/timeouts/honest replies.

## Cluster 4 — CRM WebApp/admin UX

- independent `/crm/` UI;
- access/loading/empty/error/list/detail/save/not-found states;
- status, scheduling, notes, timeline and contact actions;
- Telegram viewport/safe-area/mobile ergonomics.

## Cluster 5 — Client UX and public presentation

- contact step, on-site success and optional Telegram;
- route/deep-link/back/reload/draft recovery;
- verified media replacements and broken-reference gate;
- desktop layout, stable typography and accessible uploads;
- remove or honestly redesign profile stub.

## Cluster 6 — Verification and release

- unit/integration tests with isolated DB and Telegram stub;
- browser E2E for client + CRM;
- CI install/test/media gates and deploy dependency;
- Node pin, health/readiness, graceful shutdown and deploy/rollback docs.

Each cluster updates findings/progress/verification and is committed only after focused and broader checks pass.
