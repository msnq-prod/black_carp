# A03 — CRM/Admin WebApp Solution Plan

## Current disposition against WIP

Baseline contained 27 findings: 13 P1, 12 P2 and 2 P3.

Current WIP status:

- `fixed-by-WIP`: 2;
- `partially-addressed`: 8;
- `still-open`: 16;
- `needs-runtime-verification`: 1.

Therefore 25 findings are not closed: 24 still require product changes and `P1-A03-08` requires verification before closure. Closed findings are not included in the implementation plan.

| Finding | Current status | WIP evidence | Remaining scope |
|---|---|---|---|
| `P1-A03-01` | partially-addressed | client comments now use a durable outbox and delivery state (`server.js:466-507,1518-1533`) | CRM still hides text/delivery payload (`crm/app.js:142`) |
| `P1-A03-02` | still-open | list still loads only on boot/manual actions and sorts by creation (`crm/app.js:305-382`; `server.js:188-210`) | attention, unread, recency and live refresh model |
| `P1-A03-03` | partially-addressed | outbox claim/retry is concurrency-safe (`server.js:279-293,1438-1497`) | surface notification health and request-scoped retry in CRM |
| `P1-A03-04` | still-open | generic status still permits `scheduled` without schedule (`crm/app.js:10-15,168-176`; `server.js:220-233`) | enforce one scheduled invariant |
| `P1-A03-05` | still-open | list still returns/renders `createdAt`; terminal planning still hidden (`server.js:205,1268-1281`; `crm/app.js:114,141-155`) | appointment date in list and read-only terminal history |
| `P1-A03-06` | still-open | select still commits immediately and graph remains one-way (`crm/app.js:127-130,168-176`) | explicit actions, confirmation/undo/correction policy |
| `P1-A03-07` | partially-addressed | failure no longer rerenders the card, but success still replaces all detail and navigation has no dirty guard (`crm/app.js:233-260,273-303`) | per-request drafts, granular render and dirty navigation guard |
| `P1-A03-08` | needs-runtime-verification | selection version, request-scoped target id and save lock were added (`crm/app.js:23,233-303`) | deterministic delayed-response browser test only |
| `P1-A03-09` | still-open | note POST remains non-idempotent (`server.js:236-247`) | mutation operation id and response reconciliation |
| `P1-A03-10` | still-open | GET still writes `request_opened`; UI still drops payload/actor and slices 12 (`server.js:213-217`; `crm/app.js:142,155`) | separate read telemetry, semantic paged history |
| `P1-A03-11` | still-open | detail template still omits five returned questionnaire fields (`crm/app.js:149-151`; `server.js:1299-1307`) | complete field coverage and contract test |
| `P1-A03-12` | still-open | list remains above detail and reload still collapses rows (`crm/styles.css:31`; `crm/app.js:249,313-331`) | true single-pane mobile state; screenshot `15`, density screenshots `12-14` |
| `P1-A03-13` | still-open | no UI minimum or server future-date rule (`crm/app.js:153,184-188`; `server.js:249-265`) | timezone-aware future-date validation |
| `P2-A03-01` | partially-addressed | stale list responses are rejected, but refresh/filter/search still leave current detail stale (`crm/app.js:317-345,372-382`) | coherent list/detail refresh with version conflict handling |
| `P2-A03-02` | still-open | SQL search and `escapeLike` are unchanged (`server.js:188-205,1363-1365`) | Unicode-normalized literal search |
| `P2-A03-03` | partially-addressed | 15s timeout, human errors, retry and busy states added (`crm/app.js:34-67,85-88,262-370`) | explicit boot/auth/session states and local save feedback |
| `P2-A03-04` | still-open | 401/403 remain one wall with no recovery action; workspace leaks through `hidden` (`crm/index.html:18-38`; `crm/styles.css:14`) | exclusive auth state and reopen-bot/session recovery; screenshot `17` |
| `P2-A03-05` | partially-addressed | parallel hydration, stale guards and URL cleanup added (`crm/app.js:90-93,191-213,383`) | non-active loading control, retry and Telegram blob/open verification |
| `P2-A03-06` | partially-addressed | group/region/busy semantics improved (`crm/index.html:31-35`; `crm/app.js:240,276,311`) | semantic selected row, focused detail heading and focus preservation |
| `P2-A03-07` | fixed-by-WIP | dialog naming, visible focus, initial Cancel focus and return focus added; screenshot `16` (`crm/index.html:40-48`; `crm/app.js:219-230`; `crm/styles.css:30,32`) | none; do not plan |
| `P2-A03-08` | partially-addressed | dialog target and safe-area padding improved (`crm/styles.css:32-33`) | remaining touch targets, operational font sizes and responsive hierarchy |
| `P2-A03-09` | fixed-by-WIP | append is ignored while loading and button is disabled (`crm/app.js:305-346,381`) | none; do not plan |
| `P2-A03-10` | still-open | selection/filter state is still transient; Telegram BackButton unused (`crm/app.js:2-5,349-383`) | URL/history/back model and dirty-exit guard |
| `P2-A03-11` | still-open | counters remain hard-coded/global (`crm/app.js:100-104`) | agreed operational counter definitions |
| `P2-A03-12` | still-open | WIP has 12 API/integration tests but no rendered CRM test | browser state, race, keyboard and responsive coverage |
| `P3-A03-01` | still-open | raw contact/status/time labels remain (`crm/app.js:6-9,114,146,150`) | presentation labels and explicit timestamp meaning |
| `P3-A03-02` | still-open | empty notes and one-option terminal select remain (`crm/app.js:127-130,146,154`) | deliberate read-only/empty states |

## Durable implementation sequence

### 1. Operational inbox and complete request read model

Addresses `P1-A03-01..03`, `P1-A03-10..11`, `P2-A03-02`, `P2-A03-11` and the relevant part of `P3-A03-01`.

1. Define one request-list read contract containing:
   - `updatedAt`, `lastActivityAt`, `lastActivityType`;
   - `attentionKind` (`new`, `client_message`, `delivery_failed`, or null);
   - per-master unread count/state;
   - `scheduledAt` when present;
   - notification state without exposing internal transport errors by default.
2. Add per-master read ownership, preferably `crm_request_reads(request_id, master_telegram_id, last_seen_activity_at)`. Opening/marking read updates this table, not `crm_activity`.
3. Stop writing `request_opened` on `GET`. Keep page-view telemetry outside the audit feed if it is needed at all.
4. Sort the default inbox by attention and latest meaningful activity with a stable composite cursor. Keep an explicit “created newest” archive sort if needed.
5. Render client-message text and delivery state in a dedicated communication/activity row. Render status `from → to`, schedule value, actor and notification state. Paginate history instead of silently slicing 12.
6. Expose request-scoped notification recovery, e.g. `POST /api/crm/requests/:id/notifications/retry`, which retries eligible outboxes server-side. Do not require the UI to know an outbox id.
7. Render every questionnaire field already returned by the detail mapper. Add a mapper-to-view field coverage test.
8. Replace SQLite ASCII `LIKE` assumptions with a canonical search representation. Recommended MVP: normalize NFKC + lowercase in Node, store/backfill an indexed `search_text`, and escape literal wildcards correctly. FTS5 `unicode61` is an acceptable alternative if ranked/fuzzy search is desired.
9. Define counters from the same attention model. “В работе” must have an explicit status set; unread clarifications and delivery failures need visible counts or badges.

Migration/rollout:

- add the read table/search field in a versioned migration;
- backfill `search_text` from public code, client name and contact;
- initially compute attention without marking anything read, then enable read writes after UI rollout;
- monitor unread/delivery counts against raw activity/outbox queries.

Exit criteria:

- a failed Telegram client comment remains visible and readable in CRM;
- an old request with a new client message rises into attention state;
- notification failure is visible and retryable from the request;
- history reconstructs values and actors without GET-generated noise;
- lowercase Russian and literal `%`/`_` searches work.

### 2. Canonical status and schedule invariants

Addresses `P1-A03-04..06`, `P1-A03-13`, schedule parts of `P2-A03-01`, and `P3-A03-01..02`.

1. Make backend the only transition owner. Return `availableActions`/capabilities with request detail; remove the duplicated frontend transition graph.
2. Remove `scheduled` from generic status mutation. Only the schedule command may enter `scheduled`, atomically writing date, duration, comment, status and activity.
3. Enforce a future timestamp with a documented timezone/clock-skew policy. UI must label the effective timezone and set a matching minimum; server remains authoritative.
4. Render appointment time explicitly in scheduled list rows. Preserve schedule as read-only data in `done`/`cancelled` cards.
5. Replace change-on-select with explicit workflow actions or a select plus Save. The visible status must remain unchanged while confirmation is open; screenshot `16` currently shows the pending terminal value behind the dialog.
6. Decide and encode correction actions: return to review, request details again, unschedule/postpone, reopen terminal status. Record corrections as explicit activity; do not silently rewrite history.
7. Add optimistic concurrency (`version` or `updatedAt` precondition) to status/schedule operations. A 409 returns fresh state and a user-readable conflict, not only `invalid_transition`.

Migration/rollout:

- inventory `scheduled_at IS NULL`, past schedules and terminal requests with schedule data;
- agree whether invalid scheduled rows downgrade to `approved` or receive a repair date; backfill with an explicit `system_repaired` activity;
- deploy server invariant before removing permissive UI options;
- add a database-level conditional constraint on the next table rebuild where practical.

Exit criteria:

- no API path can create `scheduled` without a valid appointment;
- list, detail, history and client contract expose the same date;
- terminal records retain the appointment that occurred;
- accidental status selection cannot immediately lock the workflow.

### 3. Mutation reliability, drafts and routing state

Addresses `P1-A03-07`, `P1-A03-09`, `P2-A03-01`, `P2-A03-03..05`, `P2-A03-10`; verifies `P1-A03-08`.

1. Give every mutation a client-generated operation id. Store/replay the result using a unique `(request_id, operation_type, operation_id)` key so note and schedule retries cannot duplicate data or history.
2. Return a consistent fresh request/version from every mutation, including notes. Reconcile on ambiguous timeout by operation id before offering Retry.
3. Keep per-request form drafts outside transient DOM. Update only the section that saved, or snapshot/restore every dirty field and focus target across a detail refresh.
4. Guard switching request, filter, brand link, reload and Telegram BackButton while a draft is dirty. Offer Save/Discard/Stay; do not silently discard.
5. Model navigation as `list`/`detail(requestId)` in URL/history. Update `?request=` on selection, handle popstate and Telegram BackButton, and restore filters/search where useful.
6. Refresh list and selected detail coherently. Use background refresh that keeps current rows in place; never replace the list above an open mobile detail with a loading paragraph.
7. Centralize 401/403 handling so an expired session enters an exclusive recovery screen. Put save/error confirmation beside the affected form, not only in the distant top bar.
8. Convert attachment placeholders into disabled/loading controls; enable the real link only after hydration and provide retry on failure.
9. Add deterministic delayed-response tests for the current selection/save guard before marking `P1-A03-08` fixed.

Exit criteria:

- response loss cannot duplicate a note or schedule event;
- status save cannot erase a drafted note;
- A→B rapid selection always ends on B;
- back/reload/exit behavior is predictable and dirty-state safe;
- refresh does not move a mobile user away from the active form.

### 4. Mobile layout and accessibility architecture

Addresses `P1-A03-12`, `P2-A03-04..06`, `P2-A03-08`, and remaining `P3-A03-02`.

1. First restore state exclusivity with `[hidden] { display:none !important; }` or display rules that explicitly honor `hidden`. The access wall must never render workspace controls; screenshot `17` is the acceptance failure.
2. Choose layout from content minimums, not a 760 px device label. Recommended: single-pane list/detail through at least 1024 px or a container query that activates two panes only when both have their minimum readable widths. Screenshot `19` must have no overlap or horizontal scroll.
3. On mobile/tablet, render one pane at a time. Do not keep the full inbox above detail. Preserve separate scroll positions when moving list ↔ detail.
4. On wide desktop, make inbox and detail independently scrollable/sticky within the viewport so long detail actions do not remove access to the request list.
5. Establish operational tokens: at least 44×44 px primary touch targets, readable metadata (generally ≥13–14 px), explicit spacing between destructive/adjacent actions and safe-area padding.
6. Reorder mobile detail around tasks: identity/contact/status, appointment/clarification, notes/messages, then questionnaire/files/history. Keep save state close to the active section.
7. Add `aria-current` or equivalent to the selected row, move focus to the detail heading on intentional navigation, restore focus after granular saves, and keep live announcements short and local.
8. Render terminal status as read-only text when no actions exist; render explicit empty notes/history/attachments states.
9. Verify clipboard, datetime picker, blob opening, keyboard resize and Telegram BackButton on physical iOS/Android before release.

Exit criteria:

- auth screenshot contains only the access state;
- 390, 768 and 1024 px widths have no horizontal overflow, overlap or stacked-list scroll jump;
- key controls meet target size and save feedback is visible in context;
- keyboard and screen-reader users can identify selection and retain focus.

### 5. Tests and release gates

Addresses `P2-A03-12` and verifies every phase above. Tests should be added with each implementation slice; this phase is the final gate, not deferred cleanup.

API/contract tests:

- scheduled-without-date, past date, correction/unschedule and optimistic conflict;
- note/schedule idempotency after response loss;
- Russian case-insensitive and wildcard-literal search;
- attention/unread ordering, mark-read isolation per master and notification retry;
- detail GET has no activity side effect; history pagination retains payload/actor;
- list exposes appointment and complete questionnaire contract remains stable.

Browser tests at 390×844, 768×900 and 1440×900:

- exclusive boot/auth/list/error/empty/not-found states;
- rapid A→B selection with delayed A response;
- dirty note retained through status save and guarded on navigation;
- response-lost note retry produces one note;
- scheduled/terminal cards show correct appointment truth;
- mobile list/detail switch and save preserve scroll/focus;
- no horizontal overflow at 768; touch controls and selected-row semantics;
- dialog Cancel/Confirm, underlying status value, keyboard focus and return focus;
- attachment loading/error/retry and pagination double activation.

Release gates:

- `npm run check`, unit/integration suite and browser suite all pass;
- screenshot matrix has auth, 390, 768 and desktop states from the same build/backend;
- keyboard-only and screen-reader smoke pass;
- physical Telegram iOS/Android smoke pass;
- migration dry-run and invalid-schedule/search/read-state backfill counts are recorded;
- no finding marked `fixed-by-WIP` without a regression test or explicit runtime evidence.

## Alternatives and tradeoffs

- A simpler “sort by `updated_at`” inbox is cheaper but cannot represent per-master unread or why attention is needed; use it only as a short migration stage.
- A nullable `scheduled_at` under `status='scheduled'` preserves backward compatibility but keeps false status; reject it after backfill.
- Rebuilding the CRM with a framework is not required. The durable fixes need explicit state/contracts; they can be implemented in current vanilla JS if DOM updates and navigation are decomposed.
- Persisting drafts in `sessionStorage` improves reload recovery but contains sensitive notes; prefer in-memory per-request drafts plus an explicit dirty guard unless storage policy is approved.

