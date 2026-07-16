# A04 — Cross-area and visual problems

### P2-A04-01: Programmatic focus visibly breaks every booking transition

- **Promise:** moving to a new wizard step should announce context without damaging the premium visual system.
- **Reality:** the script focuses headings/success containers with `tabindex=-1`, but no controlled focus style exists for them; WebKit renders a bright orange outline around the title or whole success block.
- **Evidence:** current screenshots `03-booking-start.png`, `04-booking-body-zone.png`, `05-booking-size.png`, `06-booking-summary.png`, `08-booking-success.png`; focus call in `script.js` and missing corresponding selector in current `styles.css` focus list.
- **Effect:** every step looks selected/broken, and the most important success state appears inside an accidental orange frame.
- **Cause:** focus management and visual focus design were implemented separately.
- **Status:** confirmed in current WIP frontend.

### P1-A04-02: CRM access denial still renders the workspace beneath it

- **Promise:** outside Telegram, the master sees one clear restricted-access screen.
- **Reality:** `authState` becomes visible while `.workspace { display:grid }` overrides the HTML `hidden` state; the empty inbox/search continues below the warning and refresh remains active.
- **Evidence:** `screenshots/17-crm-auth-wall.png`; `crm/index.html` uses `hidden`, while `crm/styles.css` assigns display to `.workspace` without a `[hidden]` guard.
- **Effect:** the access state looks broken, exposes irrelevant controls and creates uncertainty whether CRM is partially available.
- **Cause:** author display rules and the native `hidden` contract conflict.
- **Status:** confirmed in current WIP frontend.

### P1-A04-03: CRM switches to desktop layout too early

- **Promise:** the list/detail layout remains readable through tablet and narrow desktop widths.
- **Reality:** at `768px`, the `760px` mobile breakpoint leaves a minimum 330px list beside a two-column detail. Labels and values overlap, the idea becomes a narrow vertical column, and horizontal scrolling appears.
- **Evidence:** `screenshots/19-crm-768.png`; `crm/styles.css` workspace columns and `@media (max-width:760px)`.
- **Effect:** common tablet/split-screen widths are operationally unusable and can hide or misread customer data.
- **Cause:** breakpoint is based on device width rather than the minimum width of both panes/content grids.
- **Status:** confirmed in current WIP frontend.

### P1-A04-04: Client clarification is broken across all three surfaces

- **Promise:** when more information is needed, the client can respond and the master sees the answer in the relevant request.
- **Reality:** Profile shows `need_details` without a response action; the client Telegram deep link is hidden; bot comments may select an implicit request; CRM history hides the comment payload.
- **Evidence:** A01 `P1-A01-10`; A02 `P1-A02-01..03`; A03 `P1-A03-01`.
- **Effect:** the master can request clarification but the product supplies no reliable end-to-end clarification loop.
- **Cause:** profile, bot routing and CRM activity were designed as local features without one conversation/request contract.
- **Status:** confirmed on baseline; parts of bot delivery/linking are being changed in WIP, end-to-end UX remains unresolved.

### P1-A04-05: “Scheduled” has no single truth for client or master

- **Promise:** scheduled means a real date exists and both parties can see it.
- **Reality:** CRM can set `scheduled` without a date, list rows show request creation time, terminal cards hide past schedule data, and public Profile returns no appointment time.
- **Evidence:** A03 `P1-A03-04..05`; A01 `P1-A01-10`.
- **Effect:** counters, client status and master workflow can all say “scheduled” without answering when the appointment is.
- **Cause:** status and scheduling are separate commands/contracts with no invariant or shared read model.
- **Status:** confirmed.

### P2-A04-06: Profile prioritizes branding over the only operational information

- **Promise:** Profile quickly answers “what happened to my request?”.
- **Reality:** a large decorative image and generic heading consume most of the mobile viewport; number appears at the bottom and status/time require further scrolling.
- **Evidence:** `screenshots/09-mobile-profile.png`.
- **Effect:** repeat visitors must scroll past non-changing content to reach the reason they opened Profile.
- **Cause:** profile reused editorial page hierarchy instead of an operational status hierarchy.
- **Status:** confirmed.

### P2-A04-07: CRM mobile density conflicts with its use as a Telegram touch tool

- **Promise:** a master can triage and update requests quickly on a phone.
- **Reality:** filters, metadata, history and many action buttons are small; the detail is one long document with save feedback in the distant top bar.
- **Evidence:** `screenshots/12-crm-mobile-list.png`, `13-crm-mobile-detail.png`, `14-crm-mobile-actions.png`, `15-crm-note-saved.png`; A03 `P1-A03-12`, `P2-A03-08`.
- **Effect:** scanning slows, touch errors rise and save confirmation is easy to miss.
- **Cause:** desktop editorial density was compressed rather than reorganized into mobile task sections.
- **Status:** confirmed visually and structurally.

### P2-A04-08: Current automated coverage can pass while core visual workflows are broken

- **Promise:** production-readiness checks protect booking, profile and CRM behavior.
- **Reality:** the suite validates API/security/outbox behavior but does not render browser states. Orange step outlines, the access-wall leak and 768px overlap all coexist with 12/12 passing tests.
- **Evidence:** current test run 12/12; screenshots above; A01 `P2-A01-32`; A03 `P2-A03-12`.
- **Effect:** UI regressions and cross-surface dead ends can ship behind a green build.
- **Cause:** no browser acceptance matrix for states, breakpoints, keyboard and partial failures.
- **Status:** confirmed.
