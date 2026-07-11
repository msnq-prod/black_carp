# A01 — Solution Plan

## Recommended direction

1. Make URL hash the canonical public-section state (`#/home`, `#/works`, `#/booking`, `#/profile`) and drive `setView` from it. Handle initial load, `hashchange`, back/forward and unknown routes.
2. Add a dedicated contact step with validated `clientName`, `contactType`, `contactValue`, optional comment.
3. Replace the legacy submit/redirect contract with an on-site success state containing request number, optional Telegram link and restart action.
4. Restore wizard state on reload, rotate idempotency after a confirmed success/restart, and preserve one key only for retries of the same draft.
5. Replace every missing media reference with verified repository media; add an automated broken-reference check. Do not fabricate portfolio work.
6. Build a true desktop composition from the existing restrained brand system while retaining the mobile app-like flow.
7. Ship stable font files or choose system fonts intentionally; convert upload containers to labelled, keyboard-operable controls with ≥44px targets.

## Contract impact

- Booking payload gains contact fields.
- Booking response no longer requires `telegramUrl`; it includes canonical `status` and notification outcome.
- Existing `/api/booking/status/:publicCode` can continue for the optional client status surface.

## Regression tests

- Direct `/#/booking`, reload and browser back.
- Draft restore and successful idempotency rotation.
- Required contact validation for telegram/phone/other.
- Submit success, backend error and duplicate replay UI.
- Broken local media references.
- Mobile 390×844 and desktop 1280×800 screenshots; keyboard upload/remove/focus pass.

## Rollout risk

- Existing browser drafts use the legacy shape; version stored draft data and discard incompatible drafts with a clear reset.
- Existing clients may still receive `telegramUrl`; keep it as optional compatibility data for one release.
