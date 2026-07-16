# A01 — WIP verification notes

## Evidence snapshot

- Baseline: `4fe23828c989d5619c3688dd5385e053a073ebbf`.
- Reviewed WIP files: `index.html`, `styles.css`, `script.js`, `server.js`, `test/crm.integration.test.js`.
- WIP diff digest at review time: `51e0ec91150a2fe7827b94106b4b5ab25a74fe70244f65a2dd7b5b0044297219`.
- Diff size for these files: 698 insertions, 117 deletions.
- `npm run check`: passed.
- `npm test`: passed, 12/12.
- `git diff --check HEAD -- index.html styles.css script.js server.js test/crm.integration.test.js`: passed.
- No product code was changed by A01.

The main-agent browser run loaded the current WIP frontend. Its API scenarios used a compatible already-running baseline backend; WIP backend behavior is supported by 12/12 tests, not by a second browser runtime.

## Baseline versus current count

| Status | P1 | P2 | Total P1/P2 |
|---|---:|---:|---:|
| `fixed-by-WIP` | 3 | 0 | 3 |
| `partially-addressed` | 3 | 2 | 5 |
| `still-open` | 9 | 13 | 22 |
| `needs-runtime-verification` | 0 | 2 | 2 |
| **Remaining** | **12** | **17** | **29** |

`P3-A01-33` also remains open. Therefore 30 of the original 33 A01 findings still require either implementation or runtime resolution; only three are closed by the present WIP.

## Per-finding WIP status

| Finding | Current status | Current evidence | Remaining work |
|---|---|---|---|
| `P1-A01-01` | `fixed-by-WIP` | Side fieldset/buttons at `index.html:309-315`; state/persistence at `script.js:538-550`; visible in `screenshots/04-booking-body-zone.png`. | No implementation plan; add payload/reload regression coverage. |
| `P1-A01-02` | `still-open` | WIP handlers still set only `firstTattoo` or `hasSketch` at `script.js:660-698`; they do not clear `beenToMaster`, sketch data/comment or invalid history. | Normalize dependent branch state through one transition owner. |
| `P1-A01-03` | `partially-addressed` | WIP records lost-reference count and rewinds with notice at `script.js:1390-1443`. Async compression/Continue still have no pending gate (`script.js:786-806`, `script.js:839-850`). | Model processing/lost/reattach/discard explicitly; prevent silent submit/truncation. |
| `P1-A01-04` | `still-open` | Contact fields autosave at `script.js:719-726`; idea and sketch comment still commit only on Continue at `script.js:766-775`, `script.js:839-850`. | Input-level draft persistence and reload tests. |
| `P1-A01-05` | `still-open` | Last-request write remains unguarded at `script.js:1238-1245`; success cleanup remains unguarded at `script.js:1184-1199`. | Separate remote success from best-effort device persistence. |
| `P1-A01-06` | `still-open` | `index.html:294-295` and `373-375` still have no max lengths/counters; all server failures enter connectivity copy at `script.js:1133-1143`. | Shared field limits plus correctable inline error mapping. |
| `P1-A01-07` | `fixed-by-WIP` | Clipboard returns a boolean/fallback at `script.js:1305-1328`; report includes contact and comments at `script.js:1334-1358`; copy now says “Резюме”, not all data. | No implementation plan; verify clipboard denial/legacy WebView. |
| `P1-A01-08` | `partially-addressed` | Browser abort added at `script.js:1215-1231`. Server still waits for Telegram at `server.js:168-176`, with the same order-of-magnitude timeout; unknown outcome is still labelled no connection. | Respond after commit, decouple outbox delivery, model unknown outcome/idempotent check. |
| `P1-A01-09` | `fixed-by-WIP` | Transition lock/cancel/dedup at `script.js:514-566`; choice handlers use it at `script.js:660-698`. | No implementation plan; rapid-click/Back regression test only. |
| `P1-A01-10` | `still-open` | Profile code and status endpoint are unchanged at `script.js:120-145`, `server.js:342-360`; cross-area report still confirms clarification/schedule dead ends. | Public next-action/schedule read model and state-specific CTA. |
| `P1-A01-11` | `still-open` | One-shot fetch and “обновится” copy remain at `script.js:117-144`; no online handler/retry. | Explicit retry, online refresh and truthful recovery copy. |
| `P1-A01-12` | `still-open` | All three captions remain “Описание шага маршрута” at `index.html:500-512`. | Real sequential route instructions and accessible descriptions. |
| `P1-A01-13` | `still-open` | `setView` still toggles/scrolls only at `script.js:94-118`; top-level focus is not moved. Internal heading focus remains at `script.js:489-511`. | One focus/announcement policy for every top-level view. |
| `P1-A01-14` | `partially-addressed` | WIP adds initial focus, Tab trap and return at `script.js:169-215`. Background is still not `inert`/assistively isolated. | Complete modal isolation and verify screen reader/keyboard lifecycle. |
| `P1-A01-15` | `still-open` | Hero still autoplays/loops/preloads at `index.html:18`; WIP contains no media preference/control change. | Pause/static state and reduced-motion behavior. |
| `P2-A01-16` | `still-open` | Profile still reads one `black_carp_last_booking` object at `script.js:120-145`; success still offers another request at `index.html:435-439`. | Recent-request/history or code-lookup model after product decision. |
| `P2-A01-17` | `still-open` | “Анкета заполнена” still precedes empty required fields at `index.html:399-433`; visible in `screenshots/06-booking-summary.png`. | Truthful completion/progress hierarchy. |
| `P2-A01-18` | `still-open` | Summary has no Edit controls; restart still calls destructive reset directly at `script.js:714-718`. | Section editing and guarded restart. |
| `P2-A01-19` | `still-open` | Draft storage at `script.js:1390-1427` still lacks schema version, timestamps, expiry and owner/resume UI. | Versioned expiring draft plus Resume/Discard. |
| `P2-A01-20` | `still-open` | Profile still formats local `submittedAt` before fetch try/catch at `script.js:127-140`; server timestamp is ignored. | Authoritative server time and malformed-local-data recovery. |
| `P2-A01-21` | `needs-runtime-verification` | Public status route still has no explicit cache header (`server.js:342-360`) and client has no abort/request identity (`script.js:135-140`). No delayed/cache browser test was captured. | Verify headers/race; then apply freshness and stale-response guard if reproduced/confirmed. |
| `P2-A01-22` | `partially-addressed` | WIP resets file inputs and discloses lost refs, but compression still has no size/type/decode/pending state and concurrent callbacks use stale available count. | Complete file-processing state machine and device-memory tests. |
| `P2-A01-23` | `still-open` | Final controls remain divs with `type="button"` at `index.html:399-433`; submit remains click-only at `script.js:1118-1145`. | Real form and Enter/native semantics. |
| `P2-A01-24` | `partially-addressed` | WIP adds `aria-expanded`/`aria-pressed` and strong focus rules for many controls (`script.js:861-998`, `styles.css:1991-2007`). Textarea/custom input/CTA coverage remains inconsistent; headings/success show uncontrolled orange outlines. | Unified focus token/policy and screen-reader verification. |
| `P2-A01-25` | `still-open` | Contact border remains black-on-black at `styles.css:1874-1883`. `screenshots/06-booking-summary.png` shows fields blending into the page; only invalid field becomes obvious in `07-booking-validation.png`. | Visible default/focus/error field states in the dark theme. |
| `P2-A01-26` | `still-open` | Success still has code, message and “Отправить ещё одну” only (`index.html:435-439`); `screenshots/08-booking-success.png` confirms no response window/Profile action/code explanation. | Explicit next steps and Profile/optional Telegram action. |
| `P2-A01-27` | `still-open` | Consent text at `index.html:422-425` still has no inspectable data context/policy link. | Agreed privacy context and concise trust copy. |
| `P2-A01-28` | `still-open` | Runtime `subzonesData` remains the source and still omits static `Колено`/`Штанина`; price logic remains separate. | One canonical taxonomy/price contract. |
| `P2-A01-29` | `still-open` | WIP client still maps all POST errors to “Нет связи” at `script.js:1133-1143`; server still returns `rate_limited` at `server.js:984`; tests prove the limit but not UX mapping. | Error-category contract and wait/correct/retry states. |
| `P2-A01-30` | `needs-runtime-verification` | Route image sources and hero preload are unchanged; no cold-cache trace exists in current evidence. | Capture transfer/LCP first; optimize only after measurement. |
| `P2-A01-31` | `still-open` | WIP focus styling does not change `20px` reference remove or `28px` back targets (`styles.css:1744-1757`, `styles.css:1915-1927`). | Shared target size and zoom/touch verification. |
| `P2-A01-32` | `still-open` | Tests grew from 7 to 12 and pass, but additions remain backend/bot/migration. No public status, DOM, branch, file, profile or visual browser assertions exist. Passing tests coexist with visible focus/profile failures. | Public API + unit state machine + browser acceptance matrix. |

### P3 status

`P3-A01-33` is `still-open`: grammar, “Пресет”, English gallery metadata and ambiguous status wording remain. It belongs after contract/state work, not before it.

## Current screenshot evidence inspected

| Step | Screenshot | Health | A01 evidence |
|---:|---|---|---|
| 1 | `screenshots/03-booking-start.png` | poor | Bright orange default outline visibly surrounds the programmatically focused heading. |
| 2 | `screenshots/04-booking-body-zone.png` | mixed | WIP side selector is clear and usable; uncontrolled heading outline remains. |
| 3 | `screenshots/05-booking-size.png` | mixed | Presets are legible; default heading outline remains and comparison is visually abstract. |
| 4 | `screenshots/06-booking-summary.png` | poor/mixed | “Анкета заполнена” precedes mandatory work; contact controls have weak default boundaries; orange heading outline remains. |
| 5 | `screenshots/07-booking-validation.png` | mixed | Invalid name receives visible red state and focus; recovery is only a transient toast. |
| 6 | `screenshots/08-booking-success.png` | poor/mixed | Saved/not-notified copy is honest, but the entire success block receives an orange outline and next steps are absent. |
| 7 | `screenshots/09-mobile-profile.png` | poor | Decorative image dominates; only request number reaches the first viewport and status/time fall below it. |
| 8 | `screenshots/11-desktop-booking.png` | mixed | Flow is usable but the narrow top-aligned questionnaire is visually stranded in a large empty canvas. |

These screenshots cannot prove screen-reader announcements, modal background isolation, file timing, storage failure, status races, cold-cache media transfer or physical-device touch comfort.

## What the green tests do and do not prove

The 12 tests now prove stronger webhook/auth/outbox/migration behavior, trusted proxy rate buckets, normal booking persistence, idempotency and notification failure. They do not prove any current A01 WIP closure except that existing server contracts still pass. In particular they do not call `GET /api/booking/status/:publicCode` and do not execute `script.js` in a browser-like DOM.

## Required verification after implementation

1. **State tests:** all branch reversals, duplicate activation, Back, draft migration/expiry/corruption and derived payload invariants.
2. **Storage tests:** denied read/write/remove before submit, after server success and during profile load.
3. **File tests:** pending decode, corrupt/large image, concurrent selections, same-file re-add, reload reattach/discard and exact visible/submitted count.
4. **API tests:** every public status, scheduled invariant, no-store headers, delayed/duplicate response, 400/413/429/500 and commit-before-notification response.
5. **Browser tests:** mobile/desktop final form, success, all profile states, two requests, route dialog, Enter submit, top-level focus, reduced motion, zoom and touch targets.
6. **Visual assertions:** no browser-default outline on headings/success; strong focus remains on interactive controls; status card appears in the first mobile Profile viewport.
7. **Network:** cold-cache transfer proves whether route images/video need deferral.

## Residual verification limits

- No real Telegram UI or physical device.
- No VoiceOver/NVDA pass.
- No cold-cache network trace.
- No WIP backend browser runtime; WIP backend was covered by tests only.
- WIP is uncommitted and may change; re-run status mapping if its diff digest changes before implementation.
