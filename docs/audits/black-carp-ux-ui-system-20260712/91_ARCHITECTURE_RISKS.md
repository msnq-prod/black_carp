# Architecture risks

## AR1 — Request is not one product aggregate

Draft, submitted request, Telegram identity, latest local profile, status, schedule, activity and delivery are owned by separate stores/contracts. Each UI can therefore be locally correct while the next channel lacks the same context.

**Failure modes:** wrong active Telegram request, clarification text hidden in CRM, old local request lost after a second submit, client sees status without next action.

## AR2 — Status graph is mistaken for business invariants

The transition table says where a status may move, but not what must be true. `scheduled` can exist without a date; corrections and undo are mostly impossible; client-visible actions are not part of the model.

**Failure modes:** false scheduled counters, accidental irreversible moves, no client appointment truth, terminal history without schedule context.

## AR3 — Activity, telemetry and delivery are mixed

`crm_activity` carries business events, client messages, notification failures and every card open. The CRM then removes actor/payload and truncates the feed.

**Failure modes:** important actions are buried, message contents disappear, retry state is non-actionable, history cannot reconstruct an incident.

## AR4 — Hidden browser state acts as identity and workflow state

Unversioned `localStorage` holds the draft, idempotency key and one last request; Telegram routing uses implicit recency; CRM selection/filter/drafts live only in mutable JS state.

**Failure modes:** stale/shared-device drafts, lost earlier requests, wrong comment routing, dirty input loss, reload/back inconsistencies.

## AR5 — Mutations lack a common reliability model

Booking has idempotency, but notes/status/schedule and several bot acknowledgements do not. Some UI writes are immediate, some are best-effort, and ambiguous response loss is not reconciled.

**Failure modes:** duplicate notes, false failure/success feedback, irreversible accidental status, lost acknowledgements.

## AR6 — Legacy bot state mutation remains live

The product says CRM is the master interface, yet historical Telegram callback actions still mutate current statuses with changed semantics.

**Failure modes:** an old `Закрыть` button cancels a request under the new model; two master write surfaces drift.

## AR7 — Responsive behavior is device-label based

The CRM switches at `760px` even though the two-pane content needs much more room. Mobile detail is simulated by stacking the entire list above a long card.

**Failure modes:** broken 768px layout, horizontal overflow, scroll jumps after list refresh, off-screen save feedback.

## AR8 — Green integration tests do not represent product readiness

API/security/outbox tests pass while current rendered states still show focus corruption, auth/workspace collision and tablet overlap. No browser acceptance contract covers state, responsive layout, focus or recovery.

**Failure modes:** visually or operationally broken flows ship behind a green pipeline.

## AR9 — Core vocabularies are duplicated

Body taxonomy, price rules, status labels, Telegram behavior and event presentation are repeated across HTML, JS, server, docs and tests.

**Failure modes:** unreachable priced options, missing CRM questionnaire fields, inconsistent labels and future drift during partial fixes.

