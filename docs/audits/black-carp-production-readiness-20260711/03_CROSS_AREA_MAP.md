# Cross-Area Map

## Canonical workflow

```text
Client form
  -> POST /api/booking/submit
  -> SQLite booking + attachment metadata + activity
  -> notification outbox
  -> Telegram master notification
  -> protected /crm WebApp
  -> status / note / schedule / activity
```

## Shared concepts

| Concept | Current owners | Conflict | Required owner |
|---|---|---|---|
| Booking status | website copy, booking row, callback map, history pseudo-status | different enums and events mixed with state | backend status enum + transition map |
| Master identity | `MASTER_CHAT_IDS`, callback `from.id` | destinations and identities conflated | `MASTER_TELEGRAM_IDS` after initData verification |
| Master notification | `/start` handler | client action gates lead visibility | post-submit outbox |
| Client contact | Telegram `/start` profile only | no contact if client does not open bot | booking contact fields |
| Attachment access | public static URL | CRM auth cannot protect files | authenticated attachment endpoint |
| Navigation | DOM classes, bot `#/booking` URLs | deep link is not consumed | hash route state |
| Activity | `status_history.to_status` | events masquerade as statuses | separate immutable `crm_activity` |
| Schema | startup create statements | no production evolution | versioned migrations |
| Release truth | file-existence CI | deploy is not gated by behavior | tests + migration/media/security gates |

## Cross-area failure chains

1. Missing contact + delayed notification means a submitted lead can be durable in SQLite but invisible and unreachable.
2. Public attachments negate otherwise-correct CRM authorization.
3. Unversioned schema blocks deployment of every CRM surface.
4. Broken route state invalidates bot links and client reload recovery.
5. Mixed status/activity prevents the CRM UI, bot callbacks and filters from agreeing.
6. Weak CI allows all of the above to reach the automatic main deploy.
