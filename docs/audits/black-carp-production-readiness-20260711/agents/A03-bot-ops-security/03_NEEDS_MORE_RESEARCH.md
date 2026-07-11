# A03 — Needs More Research

- Verify real Telegram webhook, WebApp button and initData on a staging bot; no production token was used.
- Inspect the host process manager, Node version, persistent volume, backup/restore and log retention.
- Confirm whether notification destinations include group chats; authorization must still use separate user ids.
- Run production smoke only after deployment is explicitly authorized and a rollback/backup is confirmed.
- Confirm Telegram rate limits and preferred retry schedule for the expected lead volume.
