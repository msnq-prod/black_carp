# Результат production-доработки

Ветка: `codex/crm-production-readiness`.

## Реализовано

- обязательный контакт и отдельный экран успеха без обязательного Telegram redirect;
- атомарное сохранение заявки, история, versioned migration и pre-migration backup;
- Telegram outbox по каждому получателю, retry/lease и deep-link в конкретную заявку;
- CRM WebApp: initData auth, allowlist, список, поиск, фильтры, карточка, статусы, заметки, планирование, история и приватные вложения;
- защита webhook, rate limit, security headers и fail-closed readiness;
- desktop/mobile public UI, рабочий `/#/booking`, восстановление анкеты и честный статус последней заявки;
- CI gate, Docker runtime и ежедневный backup;
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
- `npm test` — 7/7 pass;
- `npm audit --omit=dev` — 0 vulnerabilities;
- `docker compose config` — pass; image build не запускался, локальный Docker daemon выключен;
- browser QA — public flow, success, CRM deep-link, note save, mobile/desktop geometry, no console errors;
- backup smoke — SQLite copy readback pass.

Production deploy не выполнялся: для него нужны актуальные host secrets, подключение cron из `ops/` и запуск штатного deploy script.
