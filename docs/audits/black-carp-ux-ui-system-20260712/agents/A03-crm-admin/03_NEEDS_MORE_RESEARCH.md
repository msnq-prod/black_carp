# A03 — Needs More Research

## Browser evidence requested from main agent

Capture current runtime separately from committed `HEAD`, with build/commit noted:

1. `390×844`: boot/loading, unauthorized/expired session, full list, empty filter/search, list error, direct-link 404.
2. `390×844`: open a long card with four attachments and all questionnaire fields; before/after note or schedule save to prove list-above-detail scroll movement and focus loss.
3. `390×844`: attachment loading, early tap and failed attachment; clipboard success/failure inside Telegram WebView.
4. `390×844`: `scheduled` with no date; scheduled with date; `done`/`cancelled` that still has schedule data.
5. `390×844`: terminal confirm with keyboard focus visible; status change while a note and schedule comment are dirty.
6. `768×1024`: breakpoint edge with 330 px inbox plus two-column detail.
7. `1440×900`: long detail and long inbox to evaluate desktop scrolling, relationship between selected row and detail, and off-screen save feedback.
8. Keyboard-only sequence: search → filters → row → contact actions → status → schedule → note → history → dialog; record focus after every rerender.
9. 200% zoom/high text size and `prefers-reduced-motion` for 10–12 px metadata and smooth-scroll navigation.

## Product decisions that need an owner

- Define allowed corrections: may `approved` return to clarification/review, may a scheduled request be unscheduled, and who can reopen `done`/`cancelled`?
- Define whether direct `scheduled` without date is ever valid. If not, status and schedule must become one invariant/command.
- Define valid scheduling horizon, timezone label and whether overlap warnings are required. Current code permits past and overlapping sessions; overlap risk needs real workflow confirmation.
- Define “Готово”: completed tattoo, completed consultation, or prepared design.
- Define which statuses belong in “В работе” and which events make a request unread/attention-required.
- Define multi-master behavior: assignment/ownership, note author display and concurrent edits. Backend accepts multiple master IDs but UI has no owner/version model.

## Device/platform verification

- Physical Telegram iOS and Android: viewport/safe-area insets, software-keyboard resize, native datetime control, `target=_blank`/blob URL behavior, clipboard permissions and Telegram BackButton expectations.
- VoiceOver/TalkBack/NVDA: large live-region announcements, selected-row semantics, dialog naming, focus restoration and error announcements.
- Slow/offline connection: hanging boot, response-lost-after-commit, selection races and attachment cancellation.

## Data/scale verification

- Measure list/search latency and timeline size with realistic request/event volume; `request_opened` and repeated outbox failures can grow activity quickly.
- Inspect production data for `status='scheduled' AND scheduled_at IS NULL`, past schedules, duplicate notes and hidden client-message payloads.
- Confirm retention/export requirements for contact data, notes, activity and attachments.

## Verification and baseline gap

- Re-run tests after the moving uncommitted patch stabilizes. During this audit one intermediate workspace state failed at startup because `recoverStaleOutboxClaims` was called but undefined; isolated `HEAD` passed 7/7.
- Compare final runtime assets with both `HEAD` and the final uncommitted diff before treating browser screenshots as evidence for either baseline.
- No `04_SOLUTION_PLAN.md` was written in Iteration 1, per review gate.
