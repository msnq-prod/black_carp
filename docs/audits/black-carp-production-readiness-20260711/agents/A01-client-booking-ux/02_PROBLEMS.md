# A01 — Problems

### P1-A01-01: Client flow contradicts the approved CRM contract

- **Promise:** a client leaves a contact, submits on-site, sees success, and Telegram is optional.
- **Reality:** there are no name/contact fields; the button says `Перейти в Telegram`; success and failure both navigate to Telegram.
- **Evidence:** `index.html:390-416`; `script.js:910-948`; target `docs/crm-mvp-technical-spec.md:90-181`.
- **Effect:** the master cannot contact a client who does not open Telegram, and the conversion remains dependent on a second app.
- **Cause:** frontend still implements the legacy bot handoff contract.
- **Status:** confirmed.

### P1-A01-02: Production media references are broken

- **Promise:** works are the main proof of quality.
- **Reality:** `hero-forearm.png`, `work-shoulder.png`, and `work-detail.png` are absent from the worktree while HTML/JS preload and display them repeatedly.
- **Evidence:** `index.html:9`, `index.html:42-50`, `index.html:126-193`, `script.js:27-76`; screenshot `screenshots/02-mobile-works.jpg`.
- **Effect:** gallery, profile, posters, and home sections show empty black media areas or broken fallbacks.
- **Cause:** asset inventory and code references are not validated together.
- **Status:** confirmed.

### P1-A01-03: Bot and browser deep links cannot open the requested section

- **Promise:** `#/booking` links open the booking flow and section state survives reload/back.
- **Reality:** `setView()` only toggles classes; there is no hash parsing, `hashchange`, `popstate`, or History API. A fresh runtime navigation to `/#/booking` rendered Home.
- **Evidence:** `script.js:92-124`; bot emits `#/booking` at `server.js:217`, `server.js:225`, `server.js:248`; prior finding remains current.
- **Effect:** notification links, reload, browser back, bookmarks, and screen recovery lead to the wrong view.
- **Cause:** navigation has no URL-backed source of truth.
- **Status:** confirmed.

### P1-A01-04: Reload discards an in-progress booking

- **Promise:** a multi-step mobile form should tolerate an accidental refresh.
- **Reality:** each transition writes state, but initialization deletes it and never invokes the restore function.
- **Evidence:** `script.js:405-416`, `script.js:1090-1164`, `script.js:1239-1248`.
- **Effect:** the client must restart a long questionnaire after reload or browser eviction.
- **Cause:** abandoned persistence implementation.
- **Status:** confirmed.

### P2-A01-01: Desktop is a framed mobile preview

- **Promise:** desktop should be an editorial composition, not a stretched or simulated phone.
- **Reality:** the entire product remains capped at 520px and gains a rounded device-like frame.
- **Evidence:** `styles.css:66-73`, `styles.css:1921-1940`; screenshot `screenshots/04-desktop-home.jpg`.
- **Effect:** the public site looks like a prototype on laptop/desktop.
- **Cause:** mobile shell is the only layout architecture.
- **Status:** confirmed.

### P2-A01-02: Typography is environment-dependent

- **Promise:** typography is the core premium visual system.
- **Reality:** Inter and Cormorant Garamond are named but no font resource is loaded or shipped.
- **Evidence:** `styles.css:10-11`; `index.html:1-11`.
- **Effect:** hierarchy and line breaks differ across platforms.
- **Cause:** design tokens reference unavailable fonts.
- **Status:** confirmed.

### P2-A01-03: Profile is an unfinished promise

- **Promise:** profile shows request status and consultation date.
- **Reality:** it is static copy with an absent image and no status API integration.
- **Evidence:** `index.html:430-460`; no client call to `/api/booking/status/:publicCode` in `script.js`.
- **Effect:** a visible navigation destination communicates nonexistent functionality.
- **Cause:** placeholder surface was shipped as a main tab.
- **Status:** confirmed.

### P2-A01-04: Upload controls and feedback are not robustly accessible

- **Promise:** sketch/reference upload works by keyboard and assistive technology.
- **Reality:** click behavior is attached to non-interactive `.file-uploader` containers; the file inputs have no explicit labels; preview remove targets are only 20px.
- **Evidence:** `index.html:275-300`, `index.html:370-381`; `script.js:562-647`; `styles.css:1667-1680`.
- **Effect:** keyboard, low-vision, and motor-impaired users can struggle to upload or remove media.
- **Cause:** visual container owns interaction instead of a labelled control.
- **Status:** confirmed.
