# Ordered recommendations

## R0 — Fix current visible blockers before release

- Honor `hidden` so CRM access/boot/error/workspace states are mutually exclusive.
- Remove uncontrolled programmatic focus outlines without weakening keyboard focus.
- Switch CRM to one pane at tablet widths; verify 390/768/1024/1440.
- Add screenshot/browser assertions for these three states.

## R1 — Build one operational request read model

Add canonical `updatedAt`, last activity, attention/unread, appointment and notification health to the list/detail contract. Separate read telemetry from business activity and show actor/payload/delivery state.

## R2 — Close the clarification loop

Expose the optional request-specific Telegram link on success/Profile; use a separate claim token rather than public code; make active request explicit; show client message text/delivery in CRM; add next actions for `need_details`.

## R3 — Enforce one scheduled truth

Only a schedule command may enter `scheduled`, atomically with a valid future timestamp. Show appointment time in list/detail/terminal history and the public client contract. Define correction, unschedule and reopen policy.

## R4 — Make booking state loss-proof and honest

Normalize branch-dependent fields, model file processing/loss explicitly, persist free text consistently, keep local-storage failure outside remote success, map server errors to fields/actions and retain idempotent recovery.

## R5 — Make Profile operational

Put status/code/next action first, return scheduled time and clarification action, support multiple active requests or code lookup, and give explicit retry instead of a false automatic-recovery promise.

## R6 — Rebuild CRM interaction state, not its visual identity

Keep the current brand system, but use real list/detail navigation on mobile, local/sticky save feedback, per-request dirty drafts, explicit workflow actions, optimistic concurrency, mutation operation ids and accessible selection/focus.

## R7 — Retire bot as a second CRM

Make legacy status callbacks non-mutating, version bot actions, require private actionable master chats, handle commands/media explicitly, add request-specific follow-up buttons and document delivery as observable at-least-once.

## R8 — Establish rendered-state release gates

Add browser matrices for public and CRM states, delayed/race/error/file scenarios, keyboard/screen-reader smoke, physical Telegram iOS/Android checks and same-build screenshots. API tests remain necessary but not sufficient.

## Suggested implementation batches

1. **1–2 days:** R0 visual/state blockers and regression screenshots.
2. **3–5 days:** R3 scheduling invariant + public/CRM appointment read model.
3. **4–7 days:** R2 clarification + R1 attention/activity slice.
4. **4–7 days:** R4 booking reliability + R5 Profile.
5. **5–10 days:** R6 CRM mutation/navigation/mobile work.
6. **3–5 days:** R7 bot cleanup and live Telegram gate.
7. **Continuous, release-blocking:** R8 tests added with each batch.

Estimates are relative engineering slices, not calendar commitments; data migration and product decisions can expand them.

