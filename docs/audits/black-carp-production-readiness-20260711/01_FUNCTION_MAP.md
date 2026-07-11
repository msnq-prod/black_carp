# Function And Entrypoint Map

## Public UI

| Action | Trigger | Handler/source | State | Final effect |
|---|---|---|---|---|
| Switch section | bottom nav / CTA | `setView`, `script.js:92-124` | DOM classes only | visible section changes; URL does not |
| Browse works | Works tab | generated `works` array, `script.js:27-90` | internal feed scroll | eight slides, several broken assets |
| Open booking | nav/CTA/bot hash | `setView` | in-memory wizard | bot hash is ignored on fresh load |
| Answer wizard | option/zone/size controls | `initWizard`, `script.js:492-908` | `wizardState`, localStorage draft | advances DOM slide |
| Upload image | file input/container click | `compressImage`, upload listeners | data URL in memory | JSON attachment payload |
| Submit booking | `wizardSubmitBtn` | `submitBookingToApi`, `script.js:910-1003` | idempotency/local last booking | redirect to Telegram |
| View profile | Profile tab | static HTML | none | unfinished placeholder |

## Backend/API

| Entrypoint | Function chain | Persistence/side effect | User-visible result |
|---|---|---|---|
| `GET /health` | inline route | none | unconditional `{ok:true}` |
| `POST /api/booking/submit` | validate → save files → insert booking/attachments/history → update status | SQLite + filesystem | legacy Telegram URL |
| `GET /api/booking/status/:publicCode` | direct select | read | legacy public status |
| `POST /telegram/webhook` | secret check → dedupe check → handler → dedupe insert | SQLite + Telegram API | webhook JSON |
| `/start CODE` | `handleStart` → upsert client → update status → notify client/master | SQLite + Telegram | client confirmation/master card |
| client text | `handleClientMessage` → notify master → append pseudo-status | Telegram + history | always claims delivered |
| master callback | `handleCallback` → update booking → history → callback answer | SQLite + Telegram | inline status result |
| `/api/crm/*` | absent | absent | 404 |
| `/crm` | absent | absent | 404 |

## Administrative/developer entrypoints

| Entrypoint | Boundary | Risk |
|---|---|---|
| `npm run editor` | separate unauthenticated Express server | upload + complete `index.html` overwrite |
| `npm start` | production Express server | exposes public uploads/editor static assets |
| main push | deploy workflow | external deploy script runs without behavioral CI gate |
