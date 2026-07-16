# A04 — Verification notes

## Passed

- Baseline syntax and 7/7 integration tests passed during agent analyses.
- Stabilized WIP syntax passed; 12/12 tests passed.
- Current frontend screenshots were inspected after saving.
- Public submit created an isolated request and showed the honest `masterNotified:false` success state.
- Profile loaded the saved request/status.
- CRM list, detail, note save, terminal confirmation and auth wall were exercised with isolated data.
- No console errors/warnings were captured on the accepted public/CRM/auth states.

## Confirmed from browser

- Current body-side WIP works: `Спина — Лопатки (сзади)` reaches summary.
- Programmatic heading/success focus outline remains.
- CRM access wall and workspace render together.
- 768px CRM layout overlaps and horizontally overflows.
- Mobile Profile pushes status below the large image.
- Mobile CRM keeps dense text/actions and distant save feedback.

## Not verified

- Real Telegram UI/payload rendering and production bot behavior.
- A separately restarted WIP backend browser runtime; WIP backend was verified only by 12/12 tests in this audit.
- Physical devices, software keyboard, Telegram BackButton, blob/clipboard behavior.
- Screen readers, 200–400% zoom, forced colors and measured contrast/target exceptions.
- Cold-cache transfer cost and production data/scale.

## Residual risk

The current WIP materially improves reliability, but passing tests do not cover the visually confirmed blockers or the end-to-end clarification/scheduling contracts. Do not treat 12/12 as product UX readiness.

