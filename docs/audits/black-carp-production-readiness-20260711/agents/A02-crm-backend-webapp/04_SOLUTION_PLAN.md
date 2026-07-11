# A02 — Solution Plan

## Recommended direction

1. Split startup from app construction so tests can create an isolated app/database without binding a port.
2. Add a versioned SQLite migration runner. Migration 1 adds contact/schedule columns, `crm_notes`, `crm_activity`, and a notification outbox without losing legacy rows.
3. Define one CRM status enum and allowed transition map. Keep events in `crm_activity`; use status history only for real status transitions.
4. Implement Telegram initData validation exactly from Bot API signing rules, enforce freshness, and authorize against `MASTER_TELEGRAM_IDS`.
5. Implement `/api/crm/me`, list/search/filter/cursor, detail, status, notes, schedule and protected attachment endpoints.
6. Serve `/crm/` as an independent mobile-first WebApp. Required states: boot/auth denied/loading/empty/error/list/detail/saving/not found.
7. Remove public `/uploads`; stream files only after CRM auth with safe headers.
8. Make booking + attachment metadata + initial activity atomic; write files to a temporary directory and rename only after commit, with cleanup on failure.
9. Retire the visual editor from production scripts or make it explicitly loopback-only with a separate opt-in command and warning.

## Source of truth

- SQLite booking row owns current status and schedule.
- `crm_activity` owns immutable events.
- `crm_notes` owns internal notes.
- Verified Telegram initData owns master identity for each request.

## Migration

- Map `submitted`/`awaiting_client_start` to `new`.
- Preserve legacy statuses/events in activity payloads; map actionable legacy states to the closest new status.
- Backfill missing client contact as null/legacy and show it honestly in CRM.

## Regression tests

- Fresh and legacy database migrations.
- Valid, stale, malformed and foreign-user initData.
- List/detail/filter/cursor, unknown ids and protected attachments.
- Allowed/forbidden status transitions, notes and schedule history.
- Transaction rollback and duplicate booking replay.
- CRM UI list/detail/save/error/empty/access-denied flows.

## Rollback risk

- Back up SQLite and uploads before migration. Schema additions are forward-compatible; rollback should restore the backup, not attempt destructive down migrations.
