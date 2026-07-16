# Cross-area map

## Shared contracts

| Concept | Website/profile | Bot | CRM/backend | Conflict |
|---|---|---|---|---|
| Request identity | one local `publicCode` | `/start <publicCode>` | internal id or public code | multiple requests and active Telegram context are not explicit |
| Client clarification | no actionable `need_details` UI | free text routed implicitly | payload hidden in history | no reliable request-scoped conversation loop |
| Status | label only | legacy callbacks can mutate | one-way graph | client next actions and correction policy are missing |
| Schedule | not returned/displayed | no client schedule message | status and date are separate | `scheduled` can exist without appointment truth |
| Files | async browser state | unsupported inbound media | protected attachment blobs | pending/lost files are not end-to-end visible |
| Notification health | one `masterNotified` boolean | per-recipient delivery | outbox/history | failure/retry is not operationally actionable |
| Activity | none | text/callback events | mixed audit/view/delivery feed | payload, actor and truncation disappear in UI |

## Canonical cross-area problems

1. **Clarification loop:** A01 `P1-A01-10`, A02 `P1-A02-01..03`, A03 `P1-A03-01`, A04 `P1-A04-04`.
2. **Booking truth/branch state:** A01 `P1-A01-01..04`, A03 `P1-A03-11`.
3. **Scheduled truth:** A01 `P1-A01-10`, A03 `P1-A03-04..05`, A04 `P1-A04-05`.
4. **Attention/delivery:** A02 `P1-A02-02`, A03 `P1-A03-02..03`.
5. **Mutation reliability:** A01 `P1-A01-05..09`, A03 `P1-A03-06..09`.
6. **Navigation/focus:** A01 `P1-A01-13..14`, A03 `P1-A03-12`, A04 `P2-A04-01`, `P1-A04-02..03`.
7. **Verification gap:** A01 `P2-A01-32`, A03 `P2-A03-12`, A04 `P2-A04-08`.

## Source-of-truth risks

- Draft, submitted request, Telegram identity, operational state and delivery are owned by different stores with no versioned aggregate read model.
- `activity` mixes user-visible events, telemetry and delivery diagnostics; the frontend then removes payload/actor.
- Status transitions encode only allowed movement, not business invariants such as required schedule date or correction/undo policy.
- UI/server/docs duplicate body taxonomy, status labels, price rules and Bot behavior.
- A green API suite is treated as product readiness despite no rendered-state contract.
