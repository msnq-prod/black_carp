# A04 — Сквозной UX и browser evidence

## Evidence boundary

- Кодовые findings A01–A03 привязаны к commit `4fe2382`.
- Во время прогона в общей рабочей копии появился параллельный незакоммиченный WIP. Он не создавался аудитом. После стабилизации `npm run check` прошёл, `npm test` — 12/12.
- Текущий WIP frontend повторно загружен и снят отдельно. WIP backend не удалось поднять вторым процессом; его изменения проверены тестами, а браузерные API-сценарии выполнялись на уже запущенном baseline backend с совместимым контрактом.
- Реальный Telegram UI, production и физические устройства не использовались.
- Stable-WIP recaptures: `01–04`, `09`, `12–19`. Screenshots `05–08`, `10–11` were made earlier in the same run before the parallel WIP fully stabilized; they are visual references only and are not used to claim a WIP code fix.

## User flow captured

| Step | Surface/state | Health | Evidence |
|---|---|---|---|
| 1 | Mobile home | good | `screenshots/01-mobile-home.png` |
| 2 | Mobile works | mixed: visually strong, repeated assets | `screenshots/02-mobile-works.png` |
| 3 | Booking start | poor: programmatic focus draws a bright browser outline | `screenshots/03-booking-start.png` |
| 4 | Body zone/side | mixed: WIP restores side choice, focus defect remains | `screenshots/04-booking-body-zone.png` |
| 5 | Size | mixed: clear presets, abstract visualizer and focus defect | `screenshots/05-booking-size.png` |
| 6 | Final summary/contact | mixed: estimate is strong, mandatory work appears after “completed” | `screenshots/06-booking-summary.png` |
| 7 | Validation | acceptable recovery, transient toast | `screenshots/07-booking-validation.png` |
| 8 | Saved but Telegram unavailable | good honesty, weak next-step guidance | `screenshots/08-booking-success.png` |
| 9 | Profile | poor prioritization: status rows start below a large decorative image | `screenshots/09-mobile-profile.png` |
| 10 | Desktop home | good | `screenshots/10-desktop-home.png` |
| 11 | Desktop booking | mixed: usable but visually stranded in a large empty canvas | `screenshots/11-desktop-booking.png` |
| 12 | Mobile CRM list | mixed: all core records visible, density/targets are small | `screenshots/12-crm-mobile-list.png` |
| 13 | Mobile CRM detail | mixed: critical actions available, long/dense card | `screenshots/13-crm-mobile-detail.png` |
| 14 | Planning/notes/history | poor hierarchy and tiny operational text | `screenshots/14-crm-mobile-actions.png` |
| 15 | Note saved | mixed: save succeeds, feedback remains far in top bar | `screenshots/15-crm-note-saved.png` |
| 16 | Terminal confirmation | good guard, underlying select already shows pending terminal value | `screenshots/16-crm-terminal-confirm.png` |
| 17 | CRM outside Telegram | broken: access wall and hidden workspace render together | `screenshots/17-crm-auth-wall.png` |
| 18 | Desktop CRM | mixed: effective overview, very small metadata and long off-screen actions | `screenshots/18-crm-desktop-detail.png` |
| 19 | CRM at 768 px | broken: two-column mode overlaps text and creates horizontal overflow | `screenshots/19-crm-768.png` |

## Confirmed strengths

- Site and CRM share a coherent restrained visual language; home/works are recognizable and premium.
- Mobile booking gives one question at a time, exposes progress and focuses validation failures.
- Submission remains a success when Telegram notification fails, and current success copy says so honestly.
- CRM list exposes search, filters, basic counters, status, contact and creation time in one scan.
- CRM detail groups contact, questionnaire, idea, files, planning, notes and history; terminal status has confirmation.
- No browser console warnings/errors were recorded in the captured public, CRM and access-denied states.

## Cross-surface behavior traced

```text
site draft -> booking API -> database/outbox -> master bot notification -> CRM
      |              |                                  |
      v              v                                  v
local profile   public status API                 client /start + comments
```

The main weakness is not the visual style. Each surface owns only a partial representation of the request:

- the site owns draft/history/files and a single local request pointer;
- Telegram owns the optional client identity and extra text channel;
- CRM owns operational status, planning and notes;
- activity/outbox own delivery facts, but the UI hides their payload/actionability.

As a result, the user can see a locally coherent screen while the next surface lacks the same truth.

## Accessibility evidence

- Programmatic focus is visible but uses the browser default orange outline on headings and the whole success block; this visibly damages the intended UI and does not create a controlled focus treatment.
- Several CRM/mobile controls and metadata are visibly under comfortable touch/readability size; CSS confirms 10–12 px metadata and sub-44 px targets.
- Native dialog focus is visible in the WIP capture, but committed HEAD lacks explicit naming/focus coverage.
- Screenshot evidence cannot prove screen-reader announcements, focus trapping across every route, contrast conformance, zoom resilience or physical-device touch comfort.

## Verification performed

- In-app Browser: mobile `390×844`, desktop `1440×900`, breakpoint `768×900`.
- Current WIP: `npm run check` passed; `npm test` passed 12/12.
- Baseline agents: `npm run check` and 7/7 tests passed before WIP.
- Public success, partial Telegram failure, profile, CRM list/detail/note/dialog/auth states were exercised against isolated local data.
- Browser console logs for the accepted public/CRM/auth states were empty.
