# A01 — Needs more research after Iteration 1

## Evidence boundary

Iteration 1 is a committed-baseline code/contract audit, not the screenshot audit. Findings marked `needs visual verification` or `hypothesis` must not be promoted to visually confirmed issues until the main agent captures them in the current run.

The shared worktree developed transient uncommitted product-file changes after A01 had read `HEAD` `4fe2382`. A01 did not create, revert or re-read those moving files. At the next review gate, the main agent must decide whether browser evidence is captured from the committed baseline or the stabilized WIP and label it explicitly; mixed screenshots/code lines would be invalid evidence.

## Highest-priority browser states to capture

### Public home and works

1. Mobile home at `320×568`, `360×800` and a modern tall viewport: first paint, hero CTA, bottom-nav overlap, video motion and fixed-nav safe areas.
2. Desktop home at `1440×900`: hero hierarchy, CTA width, portfolio crops, location grid and the `520px` floating nav against a full-width page.
3. Reduced-motion emulation: prove whether the hero video still moves and whether the CSS zoom stops.
4. Cold-cache Network trace: record which route-modal PNGs, map iframe, video and below-fold portfolio assets transfer before interaction.
5. Works: first slide, after several scroll snaps, fixed “Наверх” button, keyboard scroll, leaving/returning to Works, and repeated-image perception.

### Booking happy paths

6. Mobile and desktop path: first tattoo → no sketch → body → no size → empty idea → final.
7. Alternate maximum path: existing tattoo → prior master answer → has sketch → file → back/body → size XL → long idea → three references → final.
8. Body selections `Спина / Лопатки`, `Ноги / Икра`, and custom “Другое”: capture summary text and submitted JSON to prove the default `front` contradiction.
9. Final summary before contact completion: visual hierarchy of “Анкета заполнена”, required fields, consent, send and destructive restart.
10. Contact controls on dark theme at mobile/desktop, 200% zoom and forced-colors/high-contrast mode.
11. Success with `masterNotified:true`, `masterNotified:false`, and an idempotent duplicate response; capture code visibility, next-step clarity and focus announcement.

### Back, reload, retry and draft

12. Change `firstTattoo: no → yes` after answering prior-master; inspect summary and outgoing payload.
13. Change `hasSketch: yes → no` after uploading; inspect summary, attachment array and CRM attachment count.
14. Rapid double click and rapid opposite-option click on steps 2 and 4; capture history/progress/Back behavior.
15. Browser Back/Forward versus wizard Back at every internal step; determine whether mobile system Back unexpectedly exits the questionnaire.
16. Reload while typing sketch comment, idea and final contact; record exactly which characters survive.
17. Reload on final after three reference previews; inspect previews, summary, outgoing attachments and whether any loss is disclosed.
18. Reload on `4a` before selecting a sketch versus after selecting one; verify whether the same “добавьте файл заново” copy is misleading in the first case.
19. Persist a draft, advance device clock or age it manually, reopen from a shared/new-user scenario, and document the absence of age/owner context.
20. Block/throw `localStorage` reads and writes while POST returns success; prove the false-failure loop and server-side request count.
21. Simulate response loss after server commit, then retry with the same idempotency key; verify success recovery and timestamp shown in Profile.
22. Delay/hang POST beyond 15 seconds; verify disabled state, reload escape, idempotent retry and whether assistive tech receives pending status.

### Files and validation

23. Valid JPG, PNG and WEBP; same-file remove/re-add; corrupt image; unsupported image selected by bypass; image just below/above 5MB; very large-dimension image on a memory-limited mobile emulation.
24. Select references and immediately press Continue/Submit while compression is pending.
25. Make two quick multi-file selections before callbacks finish; verify whether UI exceeds three previews and payload truncates silently.
26. Idea at 2000/2001 characters and sketch comment at 500/501; capture final error and recovery.
27. Empty/invalid name, Telegram, phone, other contact, unchecked consent, server 400, 429, 500, invalid JSON response and offline response; verify copy, icon semantics, inline persistence and focus.
28. Clipboard unavailable and clipboard write rejected; verify whether “Данные скопированы” is still shown and inspect actual clipboard content.

### Profile states

29. Empty device, loading, `new`, `in_review`, `need_details`, `approved`, `scheduled`, `done`, `cancelled`, 404 and offline.
30. For `need_details`, attempt to discover how to answer. For `scheduled`, verify absence of date/time and compare with CRM source data.
31. Stay on the offline profile while connectivity returns; prove that the screen does not refresh until view re-entry/reload.
32. Submit two active requests from one device; prove the first can no longer be opened from Profile.
33. Corrupt `black_carp_last_booking.submittedAt`; observe console/unhandled rejection and remaining DOM.
34. Delay two status responses and change/re-enter profile between them; check for code/status mismatch.
35. Inspect public status response headers and browser cache behavior after a server-side status change.

### Keyboard and assistive technology

36. Full keyboard-only traversal of Home → Booking → all branches → final → Profile; record focus after every top-level view change.
37. Route modal: opener focus, initial dialog focus, Tab/Shift+Tab containment, background nav activation, Escape close and focus restoration.
38. Accordion and size selector with VoiceOver/NVDA-equivalent semantics: announced role, expanded state, selected state and next-step context.
39. Enter on final name/contact fields; confirm absence of native submit.
40. Screenshot each custom focus ring on CTA, bottom nav, textarea, custom body field, file remove and back controls; measure contrast against adjacent pixels.
41. 200%/400% zoom and narrow reflow: body submenu, size visualizer, final summary/contact, toast, success and profile status rows.
42. Measure actual pointer targets for footer socials, Works-top, reference remove and wizard Back, including spacing exceptions.

## API/contract checks still needed

- Call `GET /api/booking/status/:publicCode` in automated tests for every public status, not-found, caching headers and authoritative `submittedAt`.
- Compare public Profile requirements with data already owned by the server (`scheduled_at`, next action, Telegram link) before judging whether the endpoint or only the UI is incomplete.
- Enumerate the public error vocabulary (`consent_required`, body/contact/file/length errors, `rate_limited`, `internal_error`) and decide which are user-correctable, retryable or wait states.
- Measure POST latency with Telegram healthy, slow, timed out and unconfigured; distinguish request persistence time from notification time.
- Verify whether multiple `MASTER_CHAT_IDS` make user-visible submit latency equal to the slowest parallel Telegram request.
- Establish the intended draft lifetime, storage privacy expectation and migration behavior before treating localStorage as a stable draft contract.

## Product questions that block final prioritization, not Iteration 1

- Is side-of-body still required product data? The current MVP says yes, while the current runtime has no control.
- Must references survive reload, or must the UI explicitly force re-selection before submit?
- Should “Профиль” remain latest-request-only, or must users track multiple concurrent requests / enter a known code?
- What exact client action is expected for `need_details`, and what scheduled information is safe to expose publicly?
- What response-time expectation can the success screen state honestly?
- What draft retention/privacy copy is appropriate for shared devices?
- Are the route captions knowingly temporary, or are the photos intended to be self-explanatory?
- Which Russian terms are canonical for `new`, `in_review`, `need_details`, `approved` and `scheduled` across site, bot and CRM?

## Verification work deliberately deferred

- No solution plan or implementation is written before the review gate.
- No claim of WCAG conformance/non-conformance is made from static code alone.
- No production URL, real Telegram account or physical device was used.
- No old audit screenshot is accepted as current visual evidence.
