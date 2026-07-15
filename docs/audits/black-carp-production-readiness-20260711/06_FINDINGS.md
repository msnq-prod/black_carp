# Canonical Findings

No P0 was proven. All listed P1 items block production acceptance until fixed.

## P1

- `P1-A01-01` client flow lacks contact/on-site success and forces Telegram.
- `P1-A01-02` production media references are broken.
- `P1-A01-03` booking deep links/history are broken.
- `P1-A01-04` reload loses the booking draft.
- `P1-A02-01` CRM/WebApp/API/auth are absent.
- `P1-A02-02` booking persistence is non-atomic.
- `P1-A02-03` attachments are publicly served.
- `P1-A02-04` legacy editor can overwrite the site without auth if exposed.
- `P1-A02-05` status and activity semantics conflict.
- `P1-A02-06` production database cannot be migrated safely.
- `P1-A03-01` master notification depends on client Telegram action.
- `P1-A03-02` webhook auth fails open.
- `P1-A03-03` client comment delivery reports false success.
- `P1-A03-04` failed notifications have no retry path.
- `P1-A03-05` Telegram update dedupe races with side effects.
- `P1-A03-06` release pipeline does not test/gate the app.

## P2

- `P2-A01-01` desktop is a framed mobile preview.
- `P2-A01-02` fonts are not shipped.
- `P2-A01-03` profile is a visible stub.
- `P2-A01-04` upload interactions are not robustly accessible.
- `P2-A02-01` idempotent response contract/race is inconsistent.
- `P2-A03-01` chat destinations and master identities are conflated.
- `P2-A03-02` transport timeout/health/shutdown are weak.
- `P2-A03-03` Node runtime compatibility is unspecified.

Detailed proof and status live in each area's `02_PROBLEMS.md`.

## Re-audit 2026-07-12 — final fix pass

The implementation re-audit found no P0 and the following confirmed P1 items. They are the acceptance scope of the final fix pass:

- `P1-R01` body side is not selectable; `bodyView` is always `front`. **Fixed locally.**
- `P1-R02` reference images are silently lost after draft reload. **Fixed locally.**
- `P1-R03` delayed wizard navigation is vulnerable to duplicate taps and stale timers. **Fixed locally.**
- `P1-R04` the booking fallback claims clipboard success even when copying failed and omits contact data. **Fixed locally.**
- `P1-R05` CRM selection/save requests can render stale data and discard note/schedule drafts after failure. **Fixed locally.**
- `P1-R06` failed client-comment delivery is not persisted to a durable retry queue despite the bot promise. **Fixed and regression-tested.**
- `P1-R07` `/start <code>` can rebind an existing request to another Telegram user. **Fixed and regression-tested.**
- `P1-R08` JSON parsing happens before booking rate limiting and webhook authentication. **Fixed and regression-tested.**
- `P1-R09` master identity falls back to notification chat ids and proxy trust does not match containerized Caddy. **Fixed and regression-tested.**
- `P1-R10` Ubuntu test portability, non-root volume ownership, container smoke, legacy migration/restore and atomic deploy provenance are not proven. **Implemented locally; GitHub/host proof remains a release gate.**

Status: all re-audit P1 code fixes are implemented on `codex/crm-production-readiness`; local Browser evidence is complete, while Docker CI and host rollout evidence remain pending.
