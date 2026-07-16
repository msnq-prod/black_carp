# A01 — Problems found in Iteration 1

No P0 finding was confirmed in this code-only pass. P1 means a broken/false core path; P2 means material confusion, accessibility/architecture risk or likely future failure; P3 means low-risk consistency debt.

## P1

### P1-A01-01: Every request is recorded as the front side even though the product promises a side choice

- **Promise:** The questionnaire collects body zone **and side**, so the master receives an anatomically correct request (`docs/black-carp-mvp.md:175-180`).
- **Reality:** `bodyView` starts as `front`; the runtime body menu has no front/back control; summary and payload always use that untouched value. Choosing `Спина` can therefore produce `Спина — Лопатки (спереди)`.
- **Evidence:** `script.js:201-214`, `script.js:751-895`, `script.js:942-945`, `script.js:1129-1133`; the server accepts and persists the value without deriving it from the zone at `server.js:116-120` and `server.js:643`.
- **Effect:** The client cannot express a core placement attribute; the master can receive factually wrong anatomy and must re-ask or may plan against bad data.
- **Cause:** Legacy `bodyView` state survived after the silhouette/side UI was replaced by an accordion menu.
- **Status:** confirmed.

### P1-A01-02: Revising a branching answer leaves contradictory hidden answers and files

- **Promise:** Going Back and changing an answer should make the resulting summary/payload match the newly selected path.
- **Reality:** Changing `firstTattoo` does not clear `beenToMaster`; changing `hasSketch` to “no” does not clear `sketchData` or its comment. The summary can say “Первая татуировка (был у этого мастера)”, or say no sketch while a sketch attachment is still submitted.
- **Evidence:** Branch handlers only update their own field at `script.js:573-617`; dependent values are initialized separately at `script.js:201-218`; summary consumes stale state at `script.js:931-945`; payload/attachments consume it at `script.js:1122-1158`.
- **Effect:** The user confirms one story while the master/CRM can receive another; Back is unsafe for correcting answers.
- **Cause:** Wizard history and wizard data are independent mutable state with no branch-normalization step.
- **Status:** confirmed.

### P1-A01-03: Reference images can disappear silently on reload or be omitted while still processing

- **Promise:** Selected reference previews imply that those images will accompany the submitted request; draft/retry behavior should not silently change the request.
- **Reality:** Storage deliberately removes every reference binary. Reload protection rewinds only required-sketch paths, not references. Compression is asynchronous, but Continue and Submit do not wait for it.
- **Evidence:** Async reference callbacks at `script.js:699-710`; Continue at `script.js:743-748`; attachments use only callbacks already completed at `script.js:1152-1157`; storage strips references at `script.js:1233-1244`; reload guard covers only `sketchData` at `script.js:1267-1271`.
- **Effect:** A user can see selected references, reload or move forward quickly, submit successfully, and never learn that the master received no references.
- **Cause:** Binary file state is excluded from persistence and has no explicit pending/lost state in the UI.
- **Status:** confirmed.

### P1-A01-04: In-progress idea and sketch-comment text is not actually autosaved

- **Promise:** Closing/reloading should preserve questionnaire progress, and failed API delivery should retain entered data for retry (`docs/black-carp-mvp.md:187`).
- **Reality:** Contact fields save on every input, but `tattooIdeaText` and `sketchComment` are copied to state only when Continue is pressed. Reload while typing loses the latest text.
- **Evidence:** Contact input persistence at `script.js:636-643`; sketch comment committed at `script.js:679-688`; idea committed at `script.js:743-748`; storage serializes only `wizardState` at `script.js:1233-1244`.
- **Effect:** Users can lose the most effortful free-text content after reload, crash, accidental close or mobile tab eviction.
- **Cause:** Autosave coverage differs by field and is tied to navigation rather than input.
- **Status:** confirmed.

### P1-A01-05: A successful backend submission can be presented forever as a failed submission when local storage is unavailable

- **Promise:** A 2xx `{ok:true}` result leads to the distinct success screen and request code.
- **Reality:** After the server response, the client writes `black_carp_last_booking` before returning. A storage exception throws into the generic failure branch. Success rendering also performs unguarded storage removals. Retry can keep returning the existing idempotent request and still never show success.
- **Evidence:** Generic submit try/catch at `script.js:999-1021`; unguarded success cleanup at `script.js:1061-1075`; unguarded last-request write at `script.js:1092-1111`; server duplicate success at `server.js:68-81`.
- **Effect:** The user is told to retry a request that already exists, may submit through another channel, and cannot reach the profile/success state in privacy-restricted or failed-storage environments.
- **Cause:** Persistence of local convenience state is inside the transactional meaning of remote success.
- **Status:** confirmed.

### P1-A01-06: Server text limits are missing from the form and collapse into an unexplained final failure

- **Promise:** A user who reaches “Отправить заявку” has a valid questionnaire or receives a field-specific recovery instruction.
- **Reality:** Idea and sketch-comment controls have no `maxlength` or counters. The server rejects idea over 2000 characters and sketch comment over 500, while the client maps both to the same retry toast.
- **Evidence:** Unlimited controls at `index.html:293-296` and `index.html:363-368`; generic catch at `script.js:1012-1020`; server limits at `server.js:646-647`.
- **Effect:** Long, thoughtful input can block the entire flow only at the last click; retrying unchanged data cannot succeed and the user is not told what to edit.
- **Cause:** Public API constraints are not shared with client validation/error mapping.
- **Status:** confirmed.

### P1-A01-07: Failed-submit recovery falsely claims data was copied and the fallback omits essential data

- **Promise:** “Данные скопированы” is a reliable recovery path if API submission fails.
- **Reality:** Clipboard support/failure returns no success flag, yet the UI always claims copying succeeded. The copied report omits name, contact, contact comment, sketch comment and every attachment.
- **Evidence:** Failure branch at `script.js:1015-1019`; clipboard function silently returns/catches at `script.js:1171-1177`; report fields at `script.js:1184-1201`.
- **Effect:** The user may leave believing the request is safely recoverable while the clipboard is empty or lacks the only way to contact them and the files they selected.
- **Cause:** Recovery copy is fire-and-forget and is generated from an incomplete legacy report contract.
- **Status:** confirmed.

### P1-A01-08: Submit has no bounded client-side timeout or recoverable pending state

- **Promise:** Sending either succeeds or reaches an explicit retryable failure state.
- **Reality:** The browser fetch has no `AbortSignal`/timeout. The button stays disabled until the promise settles. The server also waits for Telegram notification attempts before replying; each external request can take up to 15 seconds.
- **Evidence:** Button lock and fetch at `script.js:1008-1020`, `script.js:1085-1102`; synchronous notification before response at `server.js:162-170`; Telegram timeout at `server.js:838-852`.
- **Effect:** A slow/hung connection leaves “Отправляем анкету” indefinitely with no cancel, retry or explanation; reload becomes the only escape and re-enters draft/file-loss risks.
- **Cause:** Remote persistence, downstream notification and UI pending state share one unbounded request lifecycle.
- **Status:** confirmed for missing timeout/recovery; real-world frequency needs network testing.

### P1-A01-09: Rapid answer changes can corrupt wizard history and progress

- **Promise:** One question produces one deterministic next step, and Back returns to the actual previous question.
- **Reality:** Each choice schedules an unguarded delayed transition. Double-clicking or quickly choosing both options queues multiple `nextStep` calls; every call blindly pushes a target into history.
- **Evidence:** Delayed transitions at `script.js:573-617`; unconditional history push at `script.js:481-484`; progress/back derive from history length at `script.js:423-459` and `script.js:486-491`.
- **Effect:** Back can appear to do nothing, progress can jump or clamp incorrectly, and the final branch can disagree with the visible selection.
- **Cause:** Cosmetic 250ms delay is treated as navigation without input locking or transition cancellation.
- **Status:** confirmed by control flow; reproduce with rapid pointer/keyboard activation in browser.

### P1-A01-10: Public profile exposes statuses that require action but offers no way to take that action

- **Promise:** Current status helps the client understand what happened and what to do next.
- **Reality:** `need_details` is rendered as “Нужно уточнение”, but the only CTA is “Создать новую заявку”. `scheduled` exposes no appointment time. Although the API returns a Telegram URL, the profile does not use it.
- **Evidence:** Status labels and fetch at `script.js:119-143`; profile actions/fields at `index.html:445-473`; public contract at `server.js:333-352` lacks schedule details and includes an unused `telegramUrl`.
- **Effect:** A client reaches a dead end exactly when the master requests information; scheduled users cannot verify when to attend and may create duplicate requests.
- **Cause:** Profile is a status label renderer, not a state-specific client workflow, and its public contract is too thin for actionable states.
- **Status:** confirmed.

### P1-A01-11: Profile promises automatic recovery that does not exist

- **Promise:** “Статус обновится при восстановлении связи” means the visible screen will recover when connectivity returns.
- **Reality:** Status is fetched once when the profile view is entered. There is no retry button, polling, `online` listener or refresh while remaining on the view.
- **Evidence:** Profile is loaded only from `setView` at `script.js:93-117`; one-shot fetch and misleading catch copy at `script.js:119-143`.
- **Effect:** The user can wait on a permanently stale “Временно недоступен” screen and has no discoverable recovery action.
- **Cause:** Error copy describes a future state transition that the implementation never schedules.
- **Status:** confirmed.

### P1-A01-12: “Показать проход” opens three placeholder captions instead of usable directions

- **Promise:** The action provides a step-by-step route to the studio.
- **Reality:** All three photos have generic alt text and the identical caption “Описание шага маршрута”.
- **Evidence:** CTA at `index.html:80-86`; modal content at `index.html:477-503`.
- **Effect:** Users still must infer the route from photos, which is especially risky near an appointment or for blind/low-vision users.
- **Cause:** Production UI ships placeholder route copy.
- **Status:** confirmed.

### P1-A01-13: Top-level view changes can leave keyboard focus inside content that has just been hidden

- **Promise:** Activating a booking CTA or browser/hash navigation moves the user into the new screen with a perceivable context change.
- **Reality:** `setView` toggles `display:none`, title and scroll only; it does not move focus. A hero CTA remains the focused element after its home view is hidden. Internal wizard heading focus runs only during `goToSlide`, not every top-level entry.
- **Evidence:** View toggling at `script.js:93-117`; CTA/nav handlers at `script.js:146-160`; internal-only focus at `script.js:462-479`; views are hidden with CSS at `styles.css:75-92`.
- **Effect:** Keyboard and screen-reader users can lose their position or hear no new-screen context; subsequent Tab order becomes browser-dependent.
- **Cause:** SPA view state and focus state are not coordinated.
- **Status:** confirmed by code; exact browser behavior needs keyboard capture.

### P1-A01-14: Route modal does not implement modal keyboard behavior

- **Promise:** A control marked `role="dialog" aria-modal="true"` behaves as an actual modal.
- **Reality:** Opening only unhides it and locks body scroll. Focus is not moved into the dialog, not trapped, not restored, and background content is not made inert. Escape is the only keyboard-specific behavior.
- **Evidence:** Dialog markup at `index.html:477-505`; open/close handlers at `script.js:168-194`.
- **Effect:** Keyboard/screen-reader users can continue into hidden/background navigation, change views behind the overlay, or be unable to discover the close control.
- **Cause:** Visual overlay state was implemented without a dialog focus lifecycle.
- **Status:** confirmed.

### P1-A01-15: Continuous hero motion has no pause/stop control and reduced-motion does not stop the video

- **Promise:** Motion is “slow and quiet” and should not become a barrier (`docs/black-carp-mvp.md:217-235`).
- **Reality:** The hero video autoplays, loops and has no controls; CSS also zooms it continuously. The reduced-motion query shortens CSS animation but cannot stop HTML video autoplay.
- **Evidence:** `index.html:17-20`; motion styles at `styles.css:114-130`; reduced-motion rules at `styles.css:2055-2063`.
- **Effect:** Users with vestibular, attention or cognitive sensitivities cannot stop motion lasting longer than five seconds.
- **Cause:** Motion preference handling covers CSS duration only, not media playback or a user control.
- **Status:** confirmed as an accessibility risk; visual intensity needs browser review.

## P2

### P2-A01-16: “Профиль” retains only one request and silently drops access to earlier active requests

- **Promise:** The success screen explicitly supports sending another request, while Profile is the place to track requests from this device.
- **Reality:** Every success overwrites a single `black_carp_last_booking` object; Profile has no list or public-code lookup.
- **Evidence:** “Отправить ещё одну заявку” at `index.html:426-430`; single-object write at `script.js:1104-1109`; profile reads one object at `script.js:119-143`.
- **Effect:** After a second submission, the first request may still be active but becomes unreachable from the UI.
- **Cause:** Device profile is modeled as a pointer, not a collection or recoverable lookup.
- **Status:** confirmed.

### P2-A01-17: The final step says “Анкета заполнена” before mandatory contact and consent are complete

- **Promise:** Completion language means only review/send remains.
- **Reality:** The heading declares completion above empty required name/contact fields and unchecked required consent; enforcement happens only after the final click.
- **Evidence:** `index.html:390-424`; validation at `script.js:1000-1058`.
- **Effect:** Progress feels dishonest, required work appears late, and validation errors are experienced as a surprise after apparent completion.
- **Cause:** The summary step and submission prerequisites are presented as one screen but named as two different states.
- **Status:** confirmed.

### P2-A01-18: Correcting the summary is laborious, while restart destroys the full draft immediately

- **Promise:** Summary is a safe review point before sending.
- **Reality:** There are no per-row edit actions; correcting an early answer requires repeated Back presses. “Заполнить заново” immediately clears answers, files, history and idempotency key with no confirmation.
- **Evidence:** Summary/action markup at `index.html:390-424`; Back uses one history pop at `script.js:486-491`; reset and destructive storage cleanup at `script.js:494-555`.
- **Effect:** Review friction encourages submission of known errors, and an adjacent low-emphasis action can erase a long questionnaire irreversibly.
- **Cause:** Summary has no field-addressable navigation and reset has no destructive-action guard.
- **Status:** confirmed.

### P2-A01-19: Drafts persist indefinitely, resume silently and have no schema/version owner

- **Promise:** Draft persistence should help the same user resume a current request without surprising another user or restoring stale semantics.
- **Reality:** Saved state has no timestamp, expiry, version or “resume/discard” notice. It includes personal name/contact and can reopen months later on a shared device.
- **Evidence:** Raw state shape at `script.js:201-219`; persistence/restore at `script.js:1233-1314`; no metadata or migration gate is present.
- **Effect:** Stale private data can surface to another user, outdated branches can jump into later steps, and future UI changes can restore an invalid history.
- **Cause:** `localStorage` is treated as permanent canonical state rather than a versioned, user-visible draft.
- **Status:** confirmed.

### P2-A01-20: Profile displays a client-clock timestamp and can crash on malformed saved time

- **Promise:** “Отправлена” reflects the authoritative request time and Profile remains usable if local convenience data is imperfect.
- **Reality:** The client stores `new Date().toISOString()` after the response and formats it before the fetch try/catch. It ignores `submittedAt` returned by the server. An invalid stored date can throw `RangeError` and reject `loadProfileStatus` without recovery.
- **Evidence:** Client timestamp write at `script.js:1104-1109`; unguarded formatting at `script.js:125-134`; server timestamp at `server.js:123-124` and response at `server.js:348`.
- **Effect:** Wrong device clocks and delayed duplicate retries show wrong submission time; corrupted storage can leave the profile partially rendered.
- **Cause:** UI combines server status with a non-authoritative, insufficiently validated local timestamp.
- **Status:** confirmed.

### P2-A01-21: Public status reads have no explicit freshness or request-race policy

- **Promise:** “Актуальный статус” means the latest server state is displayed.
- **Reality:** Neither the public endpoint nor client fetch declares `no-store`; multiple profile loads are not aborted or tied to the current saved code, so an older response may resolve after a newer one.
- **Evidence:** Public route at `server.js:333-352`; only CRM routes receive explicit `Cache-Control: private, no-store` at `server.js:47`; client fetch at `script.js:134-143` has no cache/abort/request identity.
- **Effect:** A status screen can become stale or pair a newer visible code with an older fetch result in multi-tab/re-entry races.
- **Cause:** Public status is read as an ordinary cacheable, uncoordinated fetch despite being mutable state.
- **Status:** hypothesis; verify response headers and delayed-response ordering in browser/API tests.

### P2-A01-22: File controls have no explicit size/type/error/loading state and can exceed the visible reference limit

- **Promise:** UI says JPG/PNG up to 5MB and no more than three references; selection should either complete or produce an actionable error.
- **Reality:** `accept` is only a picker hint; code reads/compresses arbitrary selected files with no pre-check or error handlers. It does not disable navigation while decoding. Concurrent selections can calculate the same available slots before callbacks complete. Reference input is not reset after removing an image, so selecting the same file may not fire `change` again. WEBP is accepted but omitted from visible sketch limits.
- **Evidence:** Markup at `index.html:275-300` and `index.html:370-381`; compression lacks `onerror`/pending state at `script.js:378-411`; file handlers at `script.js:645-741`.
- **Effect:** Large/corrupt files can freeze or fail silently on mobile; the UI can show more references than the payload's final `slice(0,3)` sends.
- **Cause:** File picker, image decoder, preview state and submission contract are not modeled as one state machine.
- **Status:** confirmed by code; memory/performance severity needs device testing.

### P2-A01-23: The final controls are not a form, so Enter and native submission semantics are absent

- **Promise:** A contact-and-submit surface should work with standard desktop/mobile keyboard form behavior.
- **Reality:** Contact inputs, consent and submit button are inside divs; the action button is `type="button"`. There is no `form`/`submit` handler.
- **Evidence:** `index.html:393-425`; click-only listener at `script.js:999-1022`.
- **Effect:** Pressing Enter in contact fields does not submit; native form affordances and some assistive/autofill behaviors are lost.
- **Cause:** The wizard is implemented entirely as imperative click handlers.
- **Status:** confirmed; browser keyboard behavior should be captured.

### P2-A01-24: Custom controls expose visual state but not programmatic state, and several focus indicators are weak

- **Promise:** Accordion expansion, selected size and keyboard focus are perceivable without relying on hover/color alone.
- **Reality:** Runtime accordion buttons never set `aria-expanded`/`aria-controls`; size buttons never set radio/pressed state. Several controls remove outlines and replace them with subtle low-contrast borders.
- **Evidence:** Accordion creation/toggle at `script.js:767-879`; size selection at `script.js:897-917`; focus CSS at `styles.css:245-247`, `styles.css:902-905`, `styles.css:1266-1271`, `styles.css:1421-1449`.
- **Effect:** Screen-reader users cannot determine expanded/selected state; keyboard users can lose the focus location on the dark canvas.
- **Cause:** State is represented only by CSS classes and designer-light border changes.
- **Status:** confirmed structurally; complete focus-appearance judgment needs screenshots/computed styles.

### P2-A01-25: Required contact controls use an almost invisible dark border on the dark page

- **Promise:** Mandatory fields are easy to discover and distinguish from surrounding summary content on mobile and desktop.
- **Reality:** Contact inputs/select use `border: 1px solid rgba(0,0,0,.22)` over the `#070707` page, while other form controls use light `--line` borders.
- **Evidence:** Page colors at `styles.css:1-8`; contact field styles at `styles.css:1810-1833`; required controls at `index.html:406-410`.
- **Effect:** The primary required action area can look like plain text/empty space, especially at low brightness or reduced contrast.
- **Cause:** A light-theme border token appears to have been copied into the dark-theme form.
- **Status:** needs visual verification at mobile/desktop and forced-colors modes.

### P2-A01-26: Success copy does not set expectations or expose the available follow-up paths

- **Promise:** After send, the client understands what happened and how communication/status will continue.
- **Reality:** Success says only that the master will contact them. It gives no response-time expectation, no link to Profile, no explanation of the request code, and does not use the returned optional Telegram URL.
- **Evidence:** Success markup at `index.html:426-431`; message selection at `script.js:1061-1075`; API returns `telegramUrl` at `server.js:164-170`.
- **Effect:** Users may wait without knowing how long, what the code is for, where status lives, or what to do if contact never arrives.
- **Cause:** Backend returns follow-up context but the success state is treated as a terminal confirmation.
- **Status:** confirmed.

### P2-A01-27: Consent is required but informed-data context is absent

- **Promise:** The user can make an informed trust decision before sending contact details, tattoo/body information and images.
- **Reality:** One checkbox mentions processing and Telegram transfer but links to no policy and gives no concise retention, access/deletion or responsible-party context.
- **Evidence:** Data collected at `index.html:275-410`; consent control at `index.html:413-416`.
- **Effect:** Trust is weakened at the highest-friction conversion point; users cannot inspect what the consent means without leaving or guessing.
- **Cause:** Consent is implemented as a validation flag rather than an information surface.
- **Status:** confirmed as a UX/trust gap; no legal-compliance claim is made here.

### P2-A01-28: Runtime body taxonomy contradicts shipped markup/docs and makes priced options unreachable

- **Promise:** The body selector consistently offers the locations described to the user/design, including knee/full-leg choices.
- **Reality:** Initial HTML contains `Колено` and `Штанина`, but runtime JS replaces it with a list that omits both. Server/client price logic has a special `Штанина` tier that the normal UI cannot select.
- **Evidence:** Static menu at `index.html:304-310`; runtime data at `script.js:227-250` and replacement at `script.js:754-885`; price branches at `script.js:984-996` and `server.js:713-724`; planned body choices at `docs/booking-questionnaire-design.md:92-97`.
- **Effect:** Users with knee/full-leg projects must discover “Другое”; pricing and analytics taxonomy drift between UI and backend.
- **Cause:** Body-zone definitions are duplicated across HTML, JS, server price rules and design documentation.
- **Status:** confirmed.

### P2-A01-29: Rate limiting and all server errors are reduced to an immediate generic retry instruction

- **Promise:** Negative paths tell the user whether to correct data, wait or retry safely.
- **Reality:** The server counts every attempt per IP, including invalid requests, and returns 429 after the limit; the client ignores status/error/RateLimit headers and always says “попробуйте ещё раз”.
- **Evidence:** Generic client handling at `script.js:1092-1102` and `script.js:1015-1019`; server limiter at `server.js:921-937`; test confirms invalid requests consume the bucket at `test/crm.integration.test.js:178-191`.
- **Effect:** Repeatedly following the UI instruction can extend a dead end; users behind shared NAT/Wi-Fi can be blocked without explanation.
- **Cause:** The public error contract is machine-coded but has no UX mapping.
- **Status:** confirmed.

### P2-A01-30: Hidden route media may impose a multi-megabyte initial-load cost

- **Promise:** Mobile users should reach the hero and booking CTA without paying for optional route instructions they did not open.
- **Reality:** Three route PNGs (~1.7MB, ~1.8MB, ~2.3MB) have ordinary `src` attributes under a hidden modal and no `loading="lazy"`; hero video is `preload="auto"` (~1.3MB).
- **Evidence:** `index.html:17-20`, `index.html:477-503`; repository measurement from `ls -lh assets/media assets/media/route` on the audited baseline.
- **Effect:** If the browser eagerly transfers hidden images, initial mobile data cost exceeds 7MB before other portfolio media, delaying useful content on slow networks.
- **Cause:** Optional media is bound at parse time rather than modal-open time.
- **Status:** hypothesis; confirm with a fresh cold-cache network trace before treating transfer size as proven.

### P2-A01-31: Small custom controls create touch-target risk

- **Promise:** File correction, gallery navigation and wizard back actions remain reliable on touch and at zoom.
- **Reality:** Reference remove is explicitly `20px × 20px`, wizard back is `28px × 28px`, footer icon anchors have only `22px` SVG content with no padding, and the gallery top control has small padding/text.
- **Evidence:** `styles.css:645-669`, `styles.css:695-712`, `styles.css:1694-1715`, `styles.css:1865-1897`.
- **Effect:** Destructive remove and navigation actions are easier to miss or trigger incorrectly for users with limited dexterity.
- **Cause:** Visual icon dimensions are being used as interaction dimensions without a shared minimum target token.
- **Status:** needs browser measurement; spacing exceptions may change formal WCAG classification.

### P2-A01-32: Current automated tests do not protect any browser/profile contract

- **Promise:** Core happy, negative, reload/back/retry/file/keyboard states remain correct across changes.
- **Reality:** The repository has no frontend browser/DOM tests. The only integration file never calls the public status endpoint and does not exercise client state, focus or rendering.
- **Evidence:** Public-flow tests at `test/crm.integration.test.js:56-108`, `test/crm.integration.test.js:142-191`; no other test/spec files in the audited tree.
- **Effect:** Most confirmed A01 failures can regress unnoticed while `npm test` and syntax checks remain green.
- **Cause:** Verification is backend-integration-heavy and has no public UX state harness.
- **Status:** confirmed.

## P3

### P3-A01-33: User-facing language mixes grammatical error, internal terms and ambiguous status wording

- **Promise:** Copy is consistent, human and clear across a premium consultation flow.
- **Reality:** “познакомиться с стилем” is grammatically wrong; summary shows the implementation term “Пресет”; gallery metadata switches to English; client status `in_review` becomes broad “В работе”, which can be read as tattoo work rather than request review.
- **Evidence:** `index.html:250-253`; summary at `script.js:947-970`; work metadata at `script.js:27-75`; status labels at `script.js:124`.
- **Effect:** Small language breaks reduce polish and can make the stage of the request less clear.
- **Cause:** Copy comes from separate legacy/design/runtime sources without one product vocabulary.
- **Status:** confirmed; status interpretation should be checked with real users/master terminology.
