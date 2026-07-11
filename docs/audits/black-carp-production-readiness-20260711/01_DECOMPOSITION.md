# Decomposition

## A01: Client site, booking and end-user UX

- **Boundary:** публичный сайт, навигация, booking wizard, responsive/accessibility/performance, клиентский submit/status UX; backend реализация рассматривается только как внешний контракт.
- **Likely files/routes:** `index.html`, `styles.css`, `script.js`, `assets/`, `POST /api/booking/submit`, `GET /api/booking/status/:publicCode`, прошлые UI-аудиты.
- **Core questions:** можно ли без ошибок пройти весь flow; совпадает ли UI с новым CRM-контрактом; есть ли честные loading/success/error/retry состояния; готов ли mobile и desktop UX.
- **Risk focus:** ложный успех, потеря данных формы, недоступные controls, stale state, broken media, mobile viewport, desktop-прототипность.
- **Assigned artifact folder:** `agents/A01-client-booking-ux/`.

## A02: CRM backend, data model and master WebApp/admin

- **Boundary:** schema/storage, CRM API, Telegram initData authorization, attachments, list/detail/status/note/schedule/history, CRM frontend and legacy editor; Telegram delivery internals исключены.
- **Likely files/routes:** `server.js`, `editor-server.js`, `editor/`, `index_v2.html`, `script_v2.js`, `styles_v2.css`, `.env.example`, `docs/crm-mvp-technical-spec.md`.
- **Core questions:** существует ли CRM фактически; закрыты ли endpoints; сохраняются ли нужные поля; корректны ли transitions/history; пригоден ли интерфейс мастера к ежедневной работе.
- **Risk focus:** отсутствие целевой системы, auth bypass, IDOR, публичные вложения, SQL/data drift, race/duplicate update, destructive legacy editor.
- **Assigned artifact folder:** `agents/A02-crm-backend-webapp/`.

## A03: Telegram bot, security, operations and release readiness

- **Boundary:** webhook/bot flows, master notification, callbacks/messages, configuration, CI/tests/deploy, logging/recovery; UI и CRM internals рассматриваются как контракты.
- **Likely files/routes:** `server.js`, `.env.example`, `package.json`, `.github/workflows/`, `docs/telegram-*`, `docs/deploy/`, `/health`, `/telegram/webhook`.
- **Core questions:** приходит ли заявка мастеру сразу; защищен ли webhook; идемпотентны ли updates; переживает ли система сбои Telegram/процесса; воспроизводимы ли build/test/deploy.
- **Risk focus:** потерянные уведомления, replay/duplicate, callback authorization, secrets/config, rate/size abuse, backup/restore, no tests/health/observability.
- **Assigned artifact folder:** `agents/A03-bot-ops-security/`.

## Main-agent cross-area responsibilities

- сверка продуктовых обещаний, API и UI;
- дедупликация и калибровка severity;
- сквозной state/data map;
- независимая локальная и браузерная верификация;
- фиксация анализа отдельным коммитом до любых продуктовых правок.
