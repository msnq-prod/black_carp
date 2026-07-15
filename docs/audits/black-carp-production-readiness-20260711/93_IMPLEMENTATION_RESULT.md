# Результат production-доработки

Ветка: `codex/crm-production-readiness`.

## Реализовано

- обязательный контакт и отдельный экран успеха без обязательного Telegram redirect;
- атомарное сохранение заявки, история, versioned migration и pre-migration backup;
- Telegram outbox по каждому получателю, retry/lease и deep-link в конкретную заявку;
- CRM WebApp: initData auth, allowlist, список, поиск, фильтры, карточка, статусы, заметки, планирование, история и приватные вложения;
- защита webhook, rate limit, security headers и fail-closed readiness;
- desktop/mobile public UI, рабочий `/#/booking`, восстановление анкеты и честный статус последней заявки;
- CI gate, non-root Docker runtime и проверяемый backup/restore с off-host hook;
- реальные интеграционные тесты ключевого потока.

## Критерии ТЗ

| Критерий | Доказательство |
|---|---|
| Заявка без Telegram | browser flow и `POST /api/booking/submit` |
| Контакт и вложения сохраняются | integration test + CRM detail |
| Мгновенное уведомление | per-recipient outbox test |
| WebApp deep-link | test проверяет `/crm?request=<code>` |
| Доступ только мастеру | signed initData и deny tests |
| Список и карточка | API + browser QA |
| Статусы | transition test, запрещённый переход 409 |
| Заметки | API + browser QA |
| Планирование | integration test |
| История | activity assertions |
| Telegram outage не теряет заявку | full-outage retry test |
| Приватные вложения | unauthenticated 401, authenticated 200 |

## Проверка

- `npm run check` — pass;
- `npm test` — 13/13 pass;
- `npm audit --omit=dev` — 0 vulnerabilities;
- `docker compose config --quiet` — pass; image build должен подтвердить GitHub CI, локальный Docker daemon выключен;
- browser QA — fresh local server, public booking flow, body-side invariant, success, CRM refresh/card/note save/focus and mobile geometry;
- backup smoke — checksum, SQLite integrity, archive extraction and attachment readback pass.

Production deploy не выполнялся. До него обязательны green Docker/backup CI, установка host deploy/rollback scripts под SHA-контракт, external Caddy network, cron от выделенного UID/GID, off-host backup и ротация runtime secrets.
