# A02 — Verification Notes

- Current `/crm` 404 and missing endpoints are confirmed.
- Implementation proof requires authenticated API tests with generated valid initData, not a bypass flag in production paths.
- Local test mode may accept a deterministic master fixture only when `NODE_ENV=test` and an explicit test secret are both present.
- Production migration/backup remains a deployment gate outside the local code audit.
