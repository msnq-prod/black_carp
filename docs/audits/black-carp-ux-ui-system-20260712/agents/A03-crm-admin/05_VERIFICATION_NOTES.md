# A03 — Verification Notes

## Evidence used

- Baseline findings: committed `HEAD` `4fe2382` and A03 Iteration 1 artifacts.
- Current comparison: uncommitted WIP in `crm/index.html`, `crm/styles.css`, `crm/app.js`, `server.js` and `test/crm.integration.test.js`.
- Cross-area context: `03_CROSS_AREA_MAP.md`, `90_MASTER_REPORT.md` and A04 browser artifacts.
- Screenshots reviewed: `12-crm-mobile-list.png` through `19-crm-768.png`.

## Current WIP checks

- `npm run check` — pass.
- `npm test` — 12/12 pass.
- `git diff --check` — pass.
- Baseline isolated run — 7/7 tests passed.

The added tests validate durable client-comment delivery, outbox claims/retry, auth separation, webhook parsing, proxy/rate-limit behavior and migration versioning. They still do not render CRM UI.

## WIP fixes accepted for planning status

- `P2-A03-07` — `fixed-by-WIP`: dialog has explicit name/description, visible focus, initial Cancel focus and return focus. Screenshot `16` confirms visible keyboard focus. A separate status-flow issue remains because the underlying select already displays the unconfirmed terminal value; that stays under `P1-A03-06`.
- `P2-A03-09` — `fixed-by-WIP`: load-more is disabled/guarded while append is active and no longer schedules a replace reload.

## Verification-only item

- `P1-A03-08` — code now scopes saves to `targetId`, serializes mutations and ignores stale selection responses. Before closure, run deterministic browser interception:
  1. delay detail A;
  2. select A then B;
  3. assert B remains selected after A resolves;
  4. delay note response for A, switch to B, resolve A;
  5. assert note belongs once to A, B remains rendered and feedback identifies the completed action without rerendering A.

## Screenshot conclusions

- `12`: list is functional but operational text/filters remain small and there is no attention/unread signal.
- `13`: primary actions exist, but the card is long and questionnaire data remains incomplete.
- `14`: planning, notes and history are visually flat; history payload/actor is absent and tiny.
- `15`: note save works, but confirmation is distant in the top bar and the mobile document remains scroll-sensitive.
- `16`: terminal guard/focus is visibly improved; pending terminal value appears behind the dialog.
- `17`: access state is broken in current WIP because workspace/search render below it. This confirms the `hidden`/display conflict.
- `18`: desktop overview is usable, but metadata and lower actions are off-screen; list/detail do not have independent task-oriented scrolling.
- `19`: 768 px is broken by the 760 px breakpoint: overlapping values, extremely narrow idea column and horizontal overflow.

## Remaining verification gaps

- Browser evidence used current WIP frontend with an already-running compatible baseline backend; it does not prove a single final WIP build/backend pair.
- No live Telegram UI or physical Telegram WebView was used.
- No VoiceOver/TalkBack/NVDA pass was run.
- No clipboard/blob/datetime/keyboard-resize verification on physical iOS/Android.
- No production data inventory for scheduled-without-date, past dates, duplicate notes, hidden client messages or outbox failures.
- No automated browser assertions for auth exclusivity, 768 layout, dirty input, selection races, focus or attachment states.

## Verification matrix after implementation

| Area | Required proof |
|---|---|
| Operational inbox | old request with new client message rises to attention; text/delivery visible; per-master unread isolated; failed notification retry works |
| Status/schedule | generic status cannot schedule; future date required; list/detail/profile agree; terminal card retains appointment; conflict returns fresh state |
| Mutations/routing | operation-id retry is single-write; dirty fields survive unrelated saves; A→B race deterministic; back/reload/Telegram BackButton correct |
| Mobile/layout | exclusive auth state; no overflow at 390/768/1024; one pane at a time; stable scroll and local save feedback |
| Accessibility | selected row announced; detail heading focused; dialog and errors named; 44 px targets; keyboard/screen-reader smoke |
| Attachments | loading control inactive; success opens; failure retries; object URLs released |

## Rollout evidence to record

- migration version and dry-run output;
- counts of invalid/past schedules before and after repair;
- count of backfilled searchable requests and read-state rows;
- mutation idempotency conflict/replay metrics;
- notification attention/retry counts;
- same-build screenshot set and final test commands.

No product code was changed by A03 Iteration 2.
