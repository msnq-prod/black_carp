# A02 — Needs More Research

- Inspect and back up the real production SQLite schema before applying the migration; production data was not accessed.
- Confirm desired behavior for old statuses (`awaiting_client_start`, `client_linked`, `consultation_offered`, `closed`, `spam`) during migration to the CRM status set.
- Confirm retention period and deletion/export requirements for client contact data and attachments.
- Decide whether the legacy visual editor should be removed or retained as an explicitly loopback-only developer tool; it must not be treated as CRM.
- Validate attachment volume and backup requirements on the actual host.
