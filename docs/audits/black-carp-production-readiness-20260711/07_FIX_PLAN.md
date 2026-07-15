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

## Final P1 fix pass — 2026-07-12

1. Public UX truth: explicit body side, reload-safe attachment disclosure, transition locking, reset correctness and honest fallback copy.
2. CRM async ownership: request versions, stale-response rejection, preserved form drafts, timeout/retry states and attachment URL cleanup.
3. Bot durability/security: client-message outbox, claim leases, rebind guard, pre-parse guards and explicit master identity.
4. Release proof: schema v2 guard, portable tests, non-root volumes, Docker smoke, verified backup/restore and SHA-bound deploy/rollback contract.

Local implementation is complete. Browser rerun, Docker build in GitHub and external host installation remain verification gates, not additional code scope.
