# A03 — CRM/Admin WebApp: Iteration 1 Analysis

## Baseline and boundary

- Audit baseline: committed `HEAD` `4fe23828c989d5619c3688dd5385e053a073ebbf` (`Build production CRM and Telegram workflow`, 2026-07-12 08:23 +10:00).
- Included: `crm/index.html`, `crm/styles.css`, `crm/app.js`; CRM list/detail/auth/status/note/schedule/attachment/activity endpoints and mappers in `server.js`; `test/crm.integration.test.js`; `docs/crm-mvp-technical-spec.md`.
- Excluded: product-code changes, Telegram chat UI, public booking UI, and the legacy editor.
- All file:line evidence below and in `02_PROBLEMS.md` refers to committed `HEAD`, not the moving uncommitted overlay observed during this audit.

## Product promise used for comparison

The master should promptly notice requests, understand the complete questionnaire and contact context, safely move a request through statuses, preserve notes and planning input, inspect protected attachments and a meaningful history, and recover from loading/auth/network errors. The technical contract explicitly promises list/search/filter/detail/status/notes/scheduling/history and loading/empty/error/access/not-found/saving states (`docs/crm-mvp-technical-spec.md:428-490`).

## Traced implementation

### Authentication and boot

- The page loads Telegram WebApp JavaScript, then sends `Telegram.WebApp.initData` in every CRM request (`crm/index.html:51-52`, `crm/app.js:2-35`).
- Backend verifies the Telegram signature, 24-hour freshness and master allowlist (`server.js:1138-1177`).
- Both workspace and access-denied state are hidden until `/api/crm/me` settles; there is no explicit boot/loading state or request timeout (`crm/index.html:18-38`, `crm/app.js:31-35,231-242`).

### List, search and filters

- UI maintains one global mutable list state and loads 30 records at a time (`crm/app.js:23,200-229`).
- API filters by status/name/contact/code, but sorts only by request creation time and returns no scheduled time, update time, unread flag, delivery health or last activity (`server.js:182-204,1184-1197`).
- UI renders the only row timestamp from `createdAt`; the same row shape is used for scheduled requests (`crm/app.js:65-76`).
- Refresh reloads only the list. There is no polling or selected-detail refresh (`crm/app.js:245-250`).

### Detail and operational data

- Backend detail returns experience, prior-master history, sketch comment, body view, size preset, schedule, notes, actors and activity payloads (`server.js:1200-1234`).
- UI omits `firstTattoo`, `beenToMaster`, `sketchComment`, `bodyView` and `sizePreset`; activity rendering omits actor and payload and silently limits the timeline to 12 items (`crm/app.js:95-112`).
- Client Telegram messages are stored as activity payload `{ text, delivered }`, but CRM renders only the generic label “Сообщение клиента” (`server.js:433-470`, `crm/app.js:16-22,98`).

### Status and planning

- Status transitions are duplicated in frontend and backend (`crm/app.js:6-15`, `server.js:17-26`).
- Selecting a status immediately mutates the server. Only `done` and `cancelled` are confirmed; all other forward-only transitions have no explicit save or undo (`crm/app.js:85-89,124-131,156-163`).
- `scheduled` is allowed through the generic status endpoint without a date. Schedule validation accepts any parseable timestamp, including past dates (`server.js:214-227,243-259`).
- Once a request is `done` or `cancelled`, existing schedule data is returned by the API but replaced in UI by “Планирование недоступно” (`crm/app.js:97,109`; `server.js:1226-1228`).

### Notes, saves and races

- Every mutation rerenders the whole detail and reloads the list (`crm/app.js:165-182`). Unsaved text in the other form, focus and local control state are not preserved.
- Rows remain selectable during save; two `select()` calls and two mutation flows have no abort/version guard (`crm/app.js:165-198,246`; `crm/styles.css:28`).
- Notes return `{ note }`, so the common update path fetches whichever id is currently in global `state.selectedId`, not necessarily the request whose note was just created (`server.js:230-240`, `crm/app.js:169-173`).
- Note creation has no idempotency key. A response lost after commit is shown as failure and a retry can create a duplicate (`server.js:230-240`, `crm/app.js:176-178`).

### Activity and notification operations

- A read-only detail GET writes `request_opened`, so viewing and note follow-up fetches mutate history (`server.js:207-211`).
- Notification success/failure events are appended per delivery attempt; failed outbox delivery retries indefinitely (`server.js:1331-1363`).
- CRM exposes no delivery-health state or outbox id. The retry endpoint therefore has no reachable UI action (`server.js:273-279`; `crm/app.js:95-112`).

### Mobile, desktop and accessibility structure

- Desktop is a two-column document with no independently scrolling/sticky inbox (`crm/styles.css:14-15,24`).
- At `<=760px`, list and detail are stacked in one document; list has a viewport minimum height and detail sits below it (`crm/styles.css:31`). Every non-append reload temporarily replaces rows with one loading paragraph above the open detail (`crm/app.js:205-206`).
- Selected rows have visual class only; filters expose `aria-label` on a plain `div`; entire list and detail are live regions that are repeatedly replaced (`crm/index.html:31-35`, `crm/app.js:65-76,95-115`).
- Dialog has no explicit accessible name/description in committed `HEAD`, and its buttons are absent from the `:focus-visible` rule (`crm/index.html:40-49`, `crm/styles.css:29-30`).
- Many interactive targets are approximately 23–36 px high with 10–12 px labels, below a comfortable mobile target (`crm/styles.css:12,22-23,26-30`).

## Positive evidence

- API authorization and attachment streaming are protected by verified Telegram initData (`server.js:207-279,1138-1177`).
- Server and client use the same committed transition graph, and backend rejects invalid transitions (`server.js:17-26,214-227`).
- Terminal transitions use a native modal confirmation (`crm/index.html:40-49`, `crm/app.js:124-129,156-163`).
- User-provided strings rendered through template HTML are escaped (`crm/app.js:25,70-74,95-112`).
- The committed snapshot passes syntax checks and all seven existing integration tests.

## Verification performed

- `npm run check` against isolated `HEAD` snapshot: pass.
- `npm test` against isolated `HEAD` snapshot: 7/7 pass.
- SQLite probe confirmed default `LIKE` does not case-fold Cyrillic (`'Анна' LIKE '%анна%' = 0`) and the current backslash escaping does not create a literal wildcard match.
- Existing tests cover API happy path, auth, attachment protection and Telegram failure, but do not execute `crm/index.html`/`crm/app.js` in a browser and do not cover races, dirty input, scheduled-without-date, client-message visibility, search semantics, keyboard or responsive states (`test/crm.integration.test.js:56-191`).

## Concurrent uncommitted overlay observed

The shared worktree changed after inspection began. At first observation, mtimes (+10:00) were: `crm/index.html` and `index.html` 12:31:08; `script.js` 12:32:59; `Dockerfile`/`.dockerignore` 12:33:26; `docker-compose.production.example.yml` 12:33:39; workflows 12:34:14; `server.js` 12:35:06; `crm/app.js` 12:35:12. Later the overlay expanded to additional ops/docs/CSS files.

The moving patch partially addresses request timeouts, human-readable errors/retry, selection/save guards, attachment URL cleanup and dialog semantics. It was not treated as an audited product result. At one intermediate state, workspace `npm test` failed before tests with `ReferenceError: recoverStaleOutboxClaims is not defined` at `server.js:44`; the isolated committed `HEAD` remained green. No product file was changed by A03.

