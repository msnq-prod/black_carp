# A04 — Cross-area solution plan

## Current status

- **Fixed/partially addressed by WIP:** body side control; wizard transition lock; some draft/file disclosure; client request timeout; modal focus loop; bot rebind protection; durable outbox for client comments; CRM transport errors, selection/save coordination, attachment lifecycle and dialog naming.
- **Still open and visually confirmed:** booking heading/success focus outline; CRM auth/workspace collision; broken 768px layout; profile hierarchy; mobile CRM density.
- **Still open cross-area:** clarification loop, scheduled invariant, operational attention/unread, actionable delivery failures, public multi-request tracking and browser coverage.

## Recommended sequence

### 1. Stop-ship visual/state defects

1. Add a global `[hidden] { display: none !important; }` contract (or avoid author `display` on hidden sections) and verify auth/boot/error/workspace states independently.
2. Replace default outline on programmatically focused headings/containers with a deliberate non-visual focus target or a brand-safe `:focus:not(:focus-visible)` policy while preserving visible keyboard focus.
3. Move CRM single-column breakpoint to the real minimum width of list + readable detail (roughly 1000–1100px), or use a dedicated master/detail route/panel on tablet.
4. Add screenshot regressions at 390, 768 and 1440 before broader refactors.

### 2. Define one request-scoped clarification contract

1. Make `publicCode`/request id explicit in every client message and Telegram context.
2. Expose a visible optional Telegram CTA on success/Profile using the returned deep link.
3. For `need_details`, provide a request-scoped response action; do not route by implicit “most recent opened” state.
4. Render client-message text, actor, delivery state and one-tap request context in CRM.
5. Treat unsupported bot media/commands as explicit recoverable states.

### 3. Make scheduling an invariant, not two unrelated fields

1. Remove direct `status -> scheduled` mutation unless a valid future `scheduledAt` is supplied atomically.
2. Keep appointment data readable in scheduled, done and cancelled cards.
3. Put appointment time—not request creation time—into scheduled list rows.
4. Return safe appointment details and state-specific next action to public Profile.
5. Define timezone, correction/unschedule/reopen policy and test it as a state machine.

### 4. Turn CRM into an operational inbox

1. Add canonical `updatedAt`, last activity summary, unread/attention and notification-health fields to list payload.
2. Order/mark by attention, not only creation time; define counters for the whole active backlog.
3. Surface outbox failure/retry with recipient-safe status and an authorized retry command.
4. Separate user activity, delivery diagnostics and view telemetry; do not let `request_opened` bury business events.
5. Preserve selected route/filter/search and drafts; use Telegram BackButton on mobile.

### 5. Harden client and master mutations

1. Normalize dependent wizard fields whenever a branching answer changes.
2. Model file states as `processing | ready | lost-on-reload | failed`; block submit while processing and require explicit acknowledgement/re-attach when lost.
3. Move localStorage writes outside the meaning of remote submit success; show success even if local convenience storage fails.
4. Add idempotency/operation ids to note/schedule/status mutations and reconcile ambiguous network results.
5. Protect dirty note/schedule drafts on status change, row switch, reload and exit.

### 6. Reorder mobile information and accessibility

1. Put request status/code/next action above the decorative Profile image; support multiple active local requests or code lookup.
2. Split mobile CRM detail into task sections or a real detail screen; keep save feedback local/sticky.
3. Set touch targets to at least a shared 44px token and raise operational metadata size/contrast.
4. Make final booking controls a native form; add field limits/counters and error-specific copy.
5. Provide pause/stop/reduced-motion behavior for the hero video.

### 7. Verification gate

1. Browser tests for public happy/negative/reload/back/file/profile states.
2. Browser tests for CRM auth/boot/error/list/detail/save/dialog and 390/768/1440 layouts.
3. Bot payload tests for repeated/foreign/terminal `/start`, multiple requests, unsupported updates, stale callbacks and private/group chat constraints.
4. Contract tests that assert every questionnaire/schedule/activity field reaches the correct consumer.
5. Physical Telegram iOS/Android and screen-reader smoke before production release.

## Rollout

- Ship visual stop-ship fixes independently; they do not require data migration.
- Introduce clarified activity/list/schedule contracts behind backward-compatible response fields.
- Backfill attention/schedule invariants before enforcing them on writes.
- Remove legacy callback semantics only after old Telegram messages are made harmless or versioned.
- Gate release on rendered screenshots and end-to-end clarification/schedule scenarios, not API tests alone.

