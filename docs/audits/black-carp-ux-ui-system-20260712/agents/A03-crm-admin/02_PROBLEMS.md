# A03 — CRM/Admin WebApp Problems

All evidence references committed `HEAD` `4fe2382`. The uncommitted overlay is moving and is documented separately in `01_ANALYSIS.md`.

## P1 — broken operational truth or loss-prone flow

### P1-A03-01: Client follow-up text is stored but invisible in CRM

- **Promise:** a comment sent by the linked client is available to the master, including when Telegram delivery fails.
- **Reality:** backend stores `{ text, delivered }`, but CRM shows only “Сообщение клиента” and discards the text and delivery result.
- **Evidence:** `server.js:433-470,1205-1206`; `crm/app.js:16-22,98,111`.
- **Effect:** the client can be told the comment was saved for later while the master cannot read it in the CRM; a key clarification can be missed.
- **Cause:** activity payload is treated as backend metadata, while the timeline renders label and time only.
- **Status:** confirmed.

### P1-A03-02: The inbox has no live or recency model

- **Promise:** the master promptly notices new requests and later activity.
- **Reality:** data loads at boot or manual refresh only; rows are ordered by `created_at`, and list payload has no `updatedAt`, last activity, unread state or attention marker.
- **Evidence:** `crm/app.js:23,200-250`; `server.js:182-204,433-470,1184-1197`.
- **Effect:** a new request can remain unseen if its bot notification fails, and a new message on an old request remains buried at its original creation position.
- **Cause:** CRM implements a static archive list rather than an operational inbox with freshness/read ownership.
- **Status:** confirmed.

### P1-A03-03: Notification failure and retry are not actionable from CRM

- **Promise:** operational delivery failure is visible and recoverable.
- **Reality:** failure is only a generic event inside an already-open card; list and counters expose no delivery health; retry requires an outbox id never mapped to the UI.
- **Evidence:** `server.js:273-279,1205-1206,1337-1363`; `crm/app.js:16-22,59-76,95-112`.
- **Effect:** the master has no way to discover which requests were not announced or to use the implemented retry operation.
- **Cause:** outbox state has no CRM presentation contract.
- **Status:** confirmed.

### P1-A03-04: “Запланировано” can be saved without any date

- **Promise:** scheduled status means a date/time was actually appointed.
- **Reality:** both status graphs allow direct transition to `scheduled`; the generic status endpoint updates only status and does not require `scheduled_at`.
- **Evidence:** `crm/app.js:10-15,85-89,124-131`; `server.js:17-26,214-227`.
- **Effect:** scheduled counters and filters can report a booked session that has no appointment, producing false operational status.
- **Cause:** status and schedule are separate writable commands without a shared invariant.
- **Status:** confirmed.

### P1-A03-05: Planning views conceal or mislabel the actual appointment

- **Promise:** the master can see the appointment date where scheduled work is managed and can reconstruct completed/cancelled work.
- **Reality:** list rows contain and render only request creation time; terminal cards hide existing `scheduledAt`, duration and comment because the schedule form is removed.
- **Evidence:** `server.js:199-204,1184-1197,1226-1228`; `crm/app.js:70-74,97,109`.
- **Effect:** in a “Запланировано” list the only unlabeled date can be mistaken for session time, while completed/cancelled cards lose their planning context.
- **Cause:** scheduling is modeled only as an editable form, not as persistent operational data with read-only states.
- **Status:** confirmed.

### P1-A03-06: Status changes are immediate, mostly irreversible and lack an explicit commit

- **Promise:** high-impact workflow changes are deliberate and recoverable from mistakes.
- **Reality:** changing the select immediately sends a mutation; only terminal statuses ask for confirmation, while forward transitions cannot be reversed by the transition graph.
- **Evidence:** `crm/app.js:10-15,85-89,124-131,156-163`; `server.js:17-26,214-227`.
- **Effect:** an accidental touch can permanently move a request out of its prior workflow state; `approved` or `scheduled` cannot return to review/clarification.
- **Cause:** a workflow command is implemented as change-on-input over a one-way state machine, with no draft, save button or undo policy.
- **Status:** confirmed.

### P1-A03-07: Any save or navigation can erase unsaved note/planning input

- **Promise:** text already entered into one CRM form is preserved while another action completes or while the user switches context.
- **Reality:** every mutation replaces the complete detail HTML; selecting another row, successful save and failed save have no dirty-state guard or field restoration.
- **Evidence:** `crm/app.js:95-115,132-133,165-198`; `crm/styles.css:28`.
- **Effect:** a drafted note or schedule comment can disappear after changing status, saving the other form, a network failure, or clicking another request.
- **Cause:** form drafts live only in transient DOM while detail state is rerendered monolithically.
- **Status:** confirmed.

### P1-A03-08: Selection and save races can show the wrong card or false save context

- **Promise:** the last selected card wins, and save feedback refers to the request the user acted on.
- **Reality:** concurrent `select()` responses have no ordering guard; rows remain active during save; after note creation the update path fetches global `state.selectedId`, which may have changed to another request.
- **Evidence:** `crm/app.js:23,165-198,246`; `server.js:230-240`; `crm/styles.css:28`.
- **Effect:** a slower earlier click can overwrite a newer selection; a note saved to request A can finish by rendering request B and saying “Сохранено”, or say failure after A was already committed.
- **Cause:** async work is coordinated through mutable global selection rather than request-scoped identity/versioning.
- **Status:** confirmed.

### P1-A03-09: Ambiguous network failure can duplicate internal notes

- **Promise:** retrying after an uncertain response does not duplicate a durable action.
- **Reality:** note POST always inserts a new id; frontend reports any lost/error response as “Не удалось сохранить” and offers no committed/unknown distinction.
- **Evidence:** `server.js:230-240`; `crm/app.js:31-35,165-180`.
- **Effect:** if the server commits and the response is lost, a reasonable retry creates a second identical note and history entry.
- **Cause:** mutation contract has no client operation id/idempotency and UI has no reconciliation step.
- **Status:** confirmed.

### P1-A03-10: Activity history cannot reconstruct what happened

- **Promise:** history explains status, planning, client-message and notification changes.
- **Reality:** UI drops actor and payload, shows only 12 newest events, and never signals truncation. Every detail GET adds `request_opened`; retries can repeatedly add delivery-failure events.
- **Evidence:** `server.js:207-211,1205-1206,1331-1363`; `crm/app.js:16-22,98,111`.
- **Effect:** important status/schedule events are quickly pushed out, and remaining entries say only “Статус изменён” or “Изменено планирование” without old/new value or who did it.
- **Cause:** audit history, view telemetry and delivery logs share one unbounded feed while presentation strips semantic payload.
- **Status:** confirmed.

### P1-A03-11: The card omits material questionnaire answers already returned by API

- **Promise:** the master sees the submitted questionnaire needed to evaluate the job.
- **Reality:** UI omits first-tattoo answer, previous visit to this master, body front/back, size preset and sketch comment.
- **Evidence:** mapper `server.js:1215-1223`; rendered questionnaire `crm/app.js:105-107`; target `docs/crm-mvp-technical-spec.md:304-318,452-463`.
- **Effect:** the master can assess or contact the client without seeing context the client already supplied, causing repeated questions or a wrong estimate.
- **Cause:** detail view and API contract evolved independently; no field-coverage assertion exists.
- **Status:** confirmed.

### P1-A03-12: Mobile list/detail stacking makes saves structurally scroll-unstable

- **Promise:** saving deep in a mobile card leaves the master at the action and its feedback.
- **Reality:** the entire list sits above detail; every mutation calls non-append `load()`, which temporarily collapses all rows to a loading paragraph and then expands them again.
- **Evidence:** `crm/styles.css:31`; `crm/app.js:165-175,200-218`.
- **Effect:** document height above the current viewport changes dramatically, so a save/refresh can jump the user within or out of a long card; feedback in the non-sticky top bar may be off-screen.
- **Cause:** mobile master/detail navigation is simulated by scrolling one long document, and list refresh mutates the layout above detail.
- **Status:** confirmed; visual magnitude needs capture.

### P1-A03-13: Planning accepts timestamps in the past

- **Promise:** an appointment saved as scheduled is a usable future/current plan.
- **Reality:** UI provides no minimum and backend accepts any parseable date, including past values.
- **Evidence:** `crm/app.js:109,133`; `server.js:243-259`.
- **Effect:** input mistakes or timezone confusion can create a successfully saved but already-expired appointment.
- **Cause:** validation checks syntax and duration only, not business-time validity.
- **Status:** confirmed.

## P2 — significant usability, accessibility or maintainability risk

### P2-A03-01: Refresh, filters and search leave an open card stale or unrelated

- **Promise:** visible list and detail represent one coherent current state.
- **Reality:** refresh reloads only list; filter/search changes never refresh or clear detail. An externally changed or excluded request can remain open with stale status options.
- **Evidence:** `crm/app.js:184-198,200-250`.
- **Effect:** the master can act from an old card while the list reflects newer/different criteria, then receive an unexplained `invalid_transition`.
- **Cause:** list and selected-detail freshness are independent with no version/updated-at contract.
- **Status:** confirmed.

### P2-A03-02: Search is unreliable for Russian names and literal wildcard characters

- **Promise:** search by name/contact/code works as typed.
- **Reality:** SQLite default `LIKE` does not case-fold Cyrillic, and `escapeLike()` adds backslashes without SQL `ESCAPE`, so lowercase Russian queries and `%`, `_`, `\` inputs behave incorrectly.
- **Evidence:** `server.js:184,194,1277-1279`; local SQLite probe: `'Анна' LIKE '%анна%' = 0`.
- **Effect:** a common lowercase search can report no result for an existing client, undermining trust in the inbox.
- **Cause:** search normalization assumes ASCII `LIKE` semantics and incomplete wildcard escaping.
- **Status:** confirmed.

### P2-A03-03: Loading and error recovery are incomplete and expose raw machine codes

- **Promise:** boot/list/detail/save states explain what is happening and offer recovery.
- **Reality:** initial workspace is blank until auth resolves; fetch has no timeout; errors show values such as `invalid_transition`, `request_failed` or browser network text; list/detail errors have no contextual retry control.
- **Evidence:** `crm/index.html:18-38`; `crm/app.js:31-35,176-178,195-197,200-242`.
- **Effect:** a slow/hung connection looks frozen, and failures do not tell the master whether to retry, refresh, reopen Telegram or correct input.
- **Cause:** transport errors are rendered directly and recovery is delegated to the unrelated top-bar refresh button.
- **Status:** confirmed in `HEAD`; partially addressed by uncommitted overlay, not verified.

### P2-A03-04: Access-denied, expired-session and wrong-master states are conflated

- **Promise:** the master understands why access failed and how to recover.
- **Reality:** both 401 and 403 show “Откройте CRM из Telegram”; the screen offers no bot/reopen action. Later 401/403 during list/save remain generic inline errors.
- **Evidence:** `crm/index.html:18-22`; `crm/app.js:231-242`; `server.js:1138-1154`.
- **Effect:** an authorized master with expired initData and an unauthorized Telegram profile receive the same guidance, and session expiry mid-work has no dedicated recovery.
- **Cause:** auth failure reason is collapsed at the UI boundary and handled only during boot.
- **Status:** confirmed.

### P2-A03-05: Attachment controls are active before ready and have no robust recovery

- **Promise:** protected references open reliably or communicate a recoverable failure.
- **Reality:** links start as `href="#"`, hydrate sequentially, remain clickable while loading, leave a dead hash link after failure, and created object URLs are never revoked.
- **Evidence:** `crm/app.js:99,114,136-149`.
- **Effect:** early taps navigate without opening the file, one slow file delays later ones, failures have no retry, and repeated card visits can retain large blobs in a long-lived WebView.
- **Cause:** async blob hydration is bolted onto active anchors without lifecycle, disabled or retry states.
- **Status:** confirmed in `HEAD`; lifecycle is partially addressed by uncommitted overlay, not verified.

### P2-A03-06: Keyboard and screen-reader selection/focus state is fragile

- **Promise:** keyboard and assistive-technology users can tell which request is selected and retain focus after actions.
- **Reality:** active row is CSS-only; whole list/detail are live regions repeatedly replaced; desktop selection does not move focus to the detail heading, while any save removes the focused control.
- **Evidence:** `crm/index.html:31-35`; `crm/app.js:65-76,95-115,165-190`; `crm/styles.css:23,30`.
- **Effect:** selected state is not announced, large repeated announcements can be noisy, and focus can fall back to the document after a save.
- **Cause:** visual rerendering is not paired with semantic selection, targeted status messages or focus restoration.
- **Status:** confirmed structurally; screen-reader behavior needs manual verification.

### P2-A03-07: Terminal confirmation dialog lacks complete keyboard semantics

- **Promise:** irreversible confirmation has an announced purpose and visible keyboard focus.
- **Reality:** committed dialog has no `aria-labelledby`/`aria-describedby`, and dialog buttons are missing from the focus-visible selector.
- **Evidence:** `crm/index.html:40-49`; `crm/styles.css:29-30`.
- **Effect:** screen-reader context may be weak and keyboard users cannot reliably see whether Cancel or Confirm is focused.
- **Cause:** native dialog behavior was relied on without explicit accessible naming/focus styling.
- **Status:** confirmed in `HEAD`; naming is partially addressed by uncommitted overlay, not verified.

### P2-A03-08: Mobile text and interaction targets are undersized

- **Promise:** a Telegram mobile CRM is comfortable under touch and at a glance.
- **Reality:** filters use 11 px text and roughly 21–23 px height; refresh is 36 px; contact/back/actions are roughly 30–34 px; operational metadata is 10–12 px.
- **Evidence:** `crm/styles.css:12,16,20,22-23,26-30`.
- **Effect:** controls are easy to mistap and high-density small text slows triage, especially under motion, glare or reduced vision.
- **Cause:** desktop editorial styling was compressed instead of defining mobile touch and readability tokens.
- **Status:** confirmed by CSS; physical-device feel needs verification.

### P2-A03-09: Double activation of “Показать ещё” can undo pagination

- **Promise:** repeated/fast activation cannot shrink an already expanded list.
- **Reality:** a second click during append sets `pendingReload`; after append finishes, the deferred call is always `load(false)`, replacing the expanded list with page one.
- **Evidence:** `crm/app.js:200-227,249`.
- **Effect:** the master can lose scroll position and the newly loaded rows immediately after asking for more.
- **Cause:** one boolean coalesces append and replace intents; the button is not disabled while loading.
- **Status:** confirmed in `HEAD`; partially addressed by uncommitted overlay, not verified.

### P2-A03-10: Routing/back/reload do not preserve working context

- **Promise:** deep link, selected request, filters and return-to-list behavior remain predictable.
- **Reality:** only initial `?request=` is read; selecting a row never updates URL/history; Telegram BackButton is unused; reload loses current selection/search/filter; brand link exits to `/` without dirty-input warning.
- **Evidence:** `crm/index.html:13`; `crm/app.js:2-5,184-198,231-250`.
- **Effect:** back/reload can abandon a draft or reopen the original deep-linked card instead of the current one, and browser/Telegram navigation cannot represent list/detail state.
- **Cause:** navigation is maintained only in transient JS/scroll state.
- **Status:** confirmed.

### P2-A03-11: Counters do not represent the real working backlog

- **Promise:** top counters communicate priority at a glance.
- **Reality:** “В работе” counts only `in_review`; `need_details` and `approved` disappear from summary, and counts remain global while search/filter results change.
- **Evidence:** `crm/app.js:59-63`; `server.js:203-204`.
- **Effect:** outstanding clarification/approved work can be invisible in the primary summary and counter numbers can appear disconnected from the visible list.
- **Cause:** counters are hard-coded presentation groups without a documented operational definition.
- **Status:** confirmed.

### P2-A03-12: There is no browser-level regression coverage for CRM UX states

- **Promise:** mobile-first list/detail/saving/error/keyboard behavior remains verifiable after changes.
- **Reality:** tests call APIs only; no test loads CRM DOM, exercises events, checks focus, dirty fields, races, responsive layout or dialog behavior.
- **Evidence:** `package.json:9-13`; `test/crm.integration.test.js:56-191`.
- **Effect:** all race, mobile-scroll, input-loss and accessibility defects above can pass CI, as committed `HEAD` currently does (7/7).
- **Cause:** acceptance testing stops at backend integration contracts.
- **Status:** confirmed.

## P3 — consistency and low-risk clarity issues

### P3-A03-01: Labels and time semantics are inconsistent

- **Promise:** status/contact/date labels are unambiguous in Russian.
- **Reality:** contact type is rendered as raw `telegram`/`phone`/`other`; `done` is “Готово” rather than clearly “Работа завершена”; row `<time>` has no `datetime` and omits a label/year.
- **Evidence:** `crm/app.js:6-9,73,102,106`; `crm/index.html:2`.
- **Effect:** state and timestamps require interpretation, especially in old or scheduled records.
- **Cause:** API enum values and compact visual copy leak directly into presentation.
- **Status:** confirmed.

### P3-A03-02: Empty and terminal sub-states look unfinished

- **Promise:** no-notes and terminal-status states read as deliberate states.
- **Reality:** an empty notes list renders nothing, and a terminal request still renders an enabled select containing only its current option.
- **Evidence:** `crm/app.js:85-89,102,110`.
- **Effect:** the interface looks incomplete and suggests interaction where none exists.
- **Cause:** one generic form template is used for all lifecycle states.
- **Status:** confirmed.

