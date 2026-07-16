# A01 — Public site, booking and profile: Iteration 1 analysis

## Baseline and boundary

- **Audited baseline:** committed `HEAD` `4fe23828c989d5619c3688dd5385e053a073ebbf` (`Build production CRM and Telegram workflow`).
- **Included:** `/`, `/#/works`, `/#/booking`, `/#/profile`, `POST /api/booking/submit`, `GET /api/booking/status/:publicCode`; `index.html`, `styles.css`, `script.js`, relevant parts of `server.js`, current product promises in `docs/black-carp-mvp.md`, and public-contract coverage in `test/crm.integration.test.js`.
- **Excluded:** Telegram UI, CRM UI, brand redesign, product-code changes, and claims that require a fresh browser screenshot/network trace.
- **Method:** line-by-line code/contract trace for happy path, negative path, branch revision, reload, retry, files, keyboard/a11y, mobile/desktop CSS and public profile state.

During the run unrelated uncommitted product-file changes appeared in the shared worktree. They were not made by A01. Per the review gate, analysis stayed on the already-read committed baseline and did not re-read the moving WIP files. This is a transient coordination risk, not a stable product finding.

## Product promises traced

The current MVP document promises an embedded step-by-step questionnaire with sketch upload, body zone and side, size helper, references, summary, estimate, consent, required contact and a distinct success screen (`docs/black-carp-mvp.md:169-187`). It also promises that failed API delivery leaves entered data available for retry (`docs/black-carp-mvp.md:187`) and that Profile shows the current status of the latest request from this device (`docs/black-carp-mvp.md:202-215`).

The implemented user flow is:

1. Home or bottom navigation changes the hash/view (`script.js:93-160`).
2. Booking starts at internal step `2`; the path branches on first tattoo and sketch (`index.html:223-302`, `script.js:573-617`).
3. Runtime JS replaces the static body menu, then advances immediately after subzone selection (`script.js:751-895`).
4. Size is optional; idea and references are also optional (`index.html:314-388`, `script.js:897-925`, `script.js:743-748`).
5. Summary is rendered before required name, contact and consent are validated (`index.html:390-424`, `script.js:927-1059`).
6. Submit sends JSON, stores the returned public code locally, clears the draft and shows success (`script.js:999-1169`).
7. Profile reads that one local code and fetches the public status contract (`script.js:119-143`, `server.js:333-352`).

## Sources of truth and state ownership

| Concern | Current owner | Observed boundary |
|---|---|---|
| Active top-level view | URL hash plus DOM classes | `navigateToView` writes hash and `setView` toggles views (`script.js:93-160`). |
| In-progress questionnaire | In-memory `wizardState` | Initialized at `script.js:201-219`; dependent branch fields are not normalized when an earlier answer changes. |
| Draft resume | Three unversioned `localStorage` keys | `black_carp_booking_state`, `black_carp_booking_history`, `black_carp_booking_idempotency_key` (`script.js:1161-1169`, `script.js:1233-1314`). Binary files are intentionally removed from the saved copy. |
| Submitted request | SQLite `booking_requests` and `booking_attachments` | Server validates, saves files, inserts request/outbox atomically, then attempts notification (`server.js:60-175`). |
| Price shown after submit | Server calculation | The client sends a price string but the server recalculates it (`script.js:1114-1141`, `server.js:87`, `server.js:713-725`). |
| Latest request visible to this browser | One `black_carp_last_booking` object | Every success overwrites the previous request reference (`script.js:1104-1109`). |
| Current public status | Server database | Endpoint returns status and server timestamps (`server.js:333-352`), but UI combines it with a client-generated timestamp (`script.js:131-142`, `script.js:1104-1109`). |

## Happy-path behavior that is present

- Direct website submission is independent of the client's Telegram account. The server persists the request/outbox before notification and can return `masterNotified: false` without losing the request (`server.js:96-170`).
- An idempotency key is reused after an uncertain submit, and the server returns the original request for duplicates (`script.js:1161-1169`, `server.js:68-81`).
- Internal wizard transitions focus the new question heading (`script.js:462-479`).
- Required contact fields receive `aria-invalid` and focus on client-side validation failure (`script.js:1024-1058`).
- The page contains a main landmark, labelled bottom navigation, labelled status terms and labelled modal (`index.html:15-16`, `index.html:460-479`, `index.html:509-536`).
- CSS includes a reduced-motion branch for CSS animation/transition durations (`styles.css:2055-2063`).
- The server-side integration suite proves successful persistence, idempotency, attachment access and the `masterNotified: false` path (`test/crm.integration.test.js:56-108`, `test/crm.integration.test.js:142-155`).

These strengths do not cover the browser state machine, file timing, local-storage failures, profile recovery, keyboard modal behavior or visual responsive states.

## Negative/recovery trace

| Scenario | Traced result |
|---|---|
| Change an earlier branching answer | Dependent fields/files remain in state and can contradict the newly selected branch. |
| Reload while typing idea/sketch comment | The latest text is lost because those controls save only on Continue. |
| Reload confirmation after adding references | Reference binaries are removed from storage and are not restored or requested again. |
| Reload confirmation after adding a required sketch | Flow rewinds to upload and shows a toast; reference files do not receive equivalent protection. |
| Select references and continue immediately | Compression is asynchronous; summary/submission can run before callbacks add attachments. |
| API succeeds but `localStorage` is unavailable | Local write throws inside the submit success path; UI enters its failure branch although the request exists. |
| API response never settles | Submit remains disabled; client fetch has no timeout or cancel/retry state. |
| Server rejects oversized text/rate limit/attachment | UI collapses every error to the same transient retry toast. |
| Profile fetch fails | UI claims status will update when connectivity returns, but no retry/poll/online handler exists. |
| Status becomes `need_details` or `scheduled` | Profile gives no action for supplying details and no scheduled date/time. |
| User submits a second request | The only local profile pointer is overwritten; there is no request history or public-code lookup. |
| Browser/assistive navigation changes view | Top-level view focus is not managed; CTA focus can remain inside a now-hidden view. |
| Route dialog opens | Visual modal opens, but focus is not moved/trapped/restored and background is not made inert. |

## Responsive, visual and accessibility code observations

- Mobile is the primary base layout; desktop expands the main shell to full width while constraining booking/profile to `760px` and bottom navigation to `520px` (`styles.css:66-73`, `styles.css:1973-2052`). Actual balance and scroll occlusion require screenshots.
- Required final contact controls use a black translucent border on the nearly black page (`styles.css:1824-1833`), unlike the light-line treatment elsewhere. Their visibility must be checked at mobile and desktop sizes.
- Several custom focus indicators are either explicitly reduced to low-contrast border changes or remove outlines (`styles.css:245-247`, `styles.css:902-905`, `styles.css:1266-1271`, `styles.css:1421-1449`). Static color calculation against `#070707` gives approximately `2.63:1` for the CTA outline and `1.72:1` for the bottom-nav outline; screenshot/browser confirmation is still required for full focus appearance.
- Accordion expansion and size selection are exposed through classes only, without `aria-expanded`, `aria-controls`, `aria-pressed` or radio semantics (`script.js:767-879`, `script.js:897-917`).
- Hero video autoplays and loops with no pause control (`index.html:17-20`); reduced-motion CSS does not stop HTML video playback.
- Route-modal images are present under a hidden modal without native lazy-loading (`index.html:477-503`). Repository sizes are about `1.7MB`, `1.8MB` and `2.3MB`; whether all are eagerly transferred on the initial route is deliberately left to a fresh network trace.
- Explicit small control sizes include the `20px` reference remove button and `28px` wizard back button (`styles.css:1694-1707`, `styles.css:1865-1877`). Actual hit regions and spacing exceptions require browser measurement.

## Verification performed

- `npm run check` — passed.
- `npm test` — passed: 7 tests, 0 failures.
- `ls -lh assets/media assets/media/route` and `file ...` — used only to establish repository media sizes/formats.
- Static contrast calculation was used as a risk signal, not a claim of complete WCAG conformance.
- No product files were edited.
- No screenshots were accepted in this subagent pass; visual evidence belongs to the main-agent browser run.

## Coverage gap in existing tests

There is no frontend DOM/browser test suite. The integration suite has one happy public submit payload, idempotency and notification failure/rate-limit checks, but no test calls `GET /api/booking/status/:publicCode` and none covers draft reload, branch revision, local-storage denial, file compression timing, profile next actions, browser Back, keyboard focus, mobile reflow or error copy (`test/crm.integration.test.js:56-108`, `test/crm.integration.test.js:142-191`).
