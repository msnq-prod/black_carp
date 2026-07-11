# Negative Paths And Races

| Scenario | Current behavior | Required behavior | Disposition |
|---|---|---|---|
| reload mid-form | draft deleted, restart | restore compatible draft | confirmed defect |
| direct `/#/booking` | Home opens | Booking opens | confirmed defect |
| duplicate submit | variant response; concurrent race possible | identical semantic result | confirmed defect |
| DB error after file write | orphan files | full rollback/cleanup | confirmed defect |
| Telegram unavailable at submit | no master attempt yet | booking saved + retry queued | target absent |
| Telegram unavailable on client comment | claims success | honest failure/retry | confirmed defect |
| duplicate webhook | side effects before dedupe insert | one reserved processing record | confirmed race |
| missing webhook secret | accepts updates | production fail closed | confirmed defect |
| unauthorized `/api/crm/*` | route absent | 401/403 after initData validation | target absent |
| foreign Telegram user | no CRM path | access denied screen/API 403 | target absent |
| public attachment URL | file served | auth-protected stream | confirmed defect |
| forbidden status transition | always writes | 409 + unchanged state | confirmed defect |
| stale CRM save | CRM absent | optimistic concurrency/current-state response | target requirement |
| empty CRM list | CRM absent | deliberate empty state | target requirement |
| deleted booking/detail | CRM absent | 404 state | target requirement |
| missing gallery file | black/broken media | automated build failure/fallback | confirmed defect |
| Node version mismatch | startup may fail | pinned supported version | confirmed risk |
| deploy with failing tests | deploy still triggers | validation dependency | confirmed defect |
