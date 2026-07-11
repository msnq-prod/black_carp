# Data Lineage

| Data | Origin | Validation | Persistence | Readers/effect | Current gap |
|---|---|---|---|---|---|
| `clientName` | target contact step | 2–80 chars | booking column | CRM card/notification | absent everywhere |
| `contactType/value/comment` | target contact step | enum + length | booking columns | master contact actions | absent everywhere |
| tattoo answers | wizard state | partial client/backend checks | booking columns | bot card/CRM detail | no shared schema contract |
| idempotency key | browser localStorage | none | unique booking column | duplicate submit | response differs; race not atomic |
| attachment data URL | browser canvas | MIME regex, count; body cap | disk + attachment row | currently public URL | no per-file max/auth/atomic cleanup |
| booking status | backend/callback | no transition policy | booking row | public status/bot/future CRM | legacy and target enums conflict |
| activity/history | system/client/master | actor check in schema | `status_history` | future timeline | events stored as pseudo-statuses |
| Telegram update id | Telegram body | numeric only | unique update row | dedupe | inserted after side effects |
| master notification result | Telegram response | transport result | booking timestamps/error | operational visibility | no retry/outbox |
| `initData` | Telegram WebApp | absent | should not persist raw value | CRM auth identity | entire path absent |
| notes | CRM master | absent | target `crm_notes` | CRM detail/history | absent |
| schedule/duration | CRM master | absent | target booking columns | CRM/list/history | absent |

## Stale/overwrite points

- Wizard draft is written then deleted at page initialization.
- Gallery data is duplicated between static HTML and JavaScript generation.
- Callback updates can overwrite any current status without transition checks.
- Polling is not implemented yet; CRM must use request-version/updated-at checks to avoid stale saves.
