# A01 — Client Site, Booking And UX Analysis

## Inspected

- `index.html`, `styles.css`, `script.js`;
- current media inventory and worktree diff;
- CRM target in `docs/crm-mvp-technical-spec.md`;
- prior mobile/visual audits;
- local runtime at `http://127.0.0.1:3107` in 390×844 and 1280×800 viewports;
- screenshots `01-mobile-home.jpg` through `05-crm-missing.jpg`.

## Current flow

1. Navigation swaps four hidden sections with `setView()` (`script.js:92-124`). It does not own a URL route.
2. The booking wizard stores answers in the module-level `wizardState`, advances through DOM slides, and serializes text/images into one JSON request (`script.js:405-421`, `script.js:979-1019`).
3. The final action requires consent, posts to `/api/booking/submit`, copies a report, and always navigates to Telegram on success or backend failure (`script.js:910-948`).
4. The new CRM specification instead requires contact fields, an on-site success state, and optional Telegram only (`docs/crm-mvp-technical-spec.md:90-181`).

## Sources of truth

- Wizard state: in-memory `wizardState` (`script.js:129-145`).
- Temporary persisted state: `black_carp_booking_state`, but it is removed at each initialization (`script.js:1090-1097`) and `loadStateFromStorage()` is never called.
- Idempotency: one localStorage key until explicit wizard reset (`script.js:1022-1030`, `script.js:432-476`).
- Gallery: duplicated JavaScript array plus pre-rendered HTML, both referencing media files (`script.js:27-76`, `index.html:126-198`).
- Section state: CSS classes only; browser URL/history are not a source of truth.

## Runtime evidence

- Mobile home renders with a coherent visual direction: `screenshots/01-mobile-home.jpg`.
- First gallery item renders as a black empty field because its source file is absent: `screenshots/02-mobile-works.jpg`.
- Booking entry is understandable and thumb-reachable: `screenshots/03-booking-start.jpg`.
- Desktop remains a centered 520px phone shell: `screenshots/04-desktop-home.jpg`; CSS caps `.app-shell` at 520px (`styles.css:66-73`).
- `/crm` is an Express 404, not an admin experience: `screenshots/05-crm-missing.jpg`.

## Positive evidence

- Main CTA and bottom navigation are visually clear on 390px width.
- Current buttons use real HTML controls and the active bottom item receives `aria-current` (`script.js:101-111`).
- Reduced-motion CSS exists (`styles.css:1943-1951`).
- The client compresses uploaded images before transport (`script.js:330-385`).

## Verification commands

- `node --check script.js` — pass.
- In-app browser DOM snapshots — Home, Works, Booking steps 1-5.
- Saved and visually inspected five current-run screenshots.
