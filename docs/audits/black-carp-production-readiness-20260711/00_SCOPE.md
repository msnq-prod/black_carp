# Black Carp Production Readiness Audit — Scope

## Target

Проверить текущее состояние всего проекта Black Carp и доказать его готовность или неготовность к production как единого продукта:

- публичный сайт и анкета клиента;
- backend, хранение заявок и CRM API;
- Telegram-бот и Telegram WebApp CRM мастера;
- административные интерфейсы;
- безопасность, надежность, тестирование и deploy-контур;
- сквозной UX от отправки заявки до обработки мастером.

## Expected business behavior

Клиент отправляет заявку с контактом и вложениями, получает честное подтверждение, мастер немедленно получает уведомление, открывает защищенную CRM из Telegram, просматривает и обрабатывает заявку, меняет статус, ведет заметки и назначает дату. Все изменения сохраняются и отражаются в истории, а сбои не приводят к потере заявки или ложному успеху.

## Included

- `index.html`, `styles.css`, `script.js` и связанные media assets;
- `server.js`, SQLite schema, API, файлы и Telegram webhook;
- `editor-server.js`, `editor/`, legacy `*_v2` поверхности;
- `.env.example`, package scripts, GitHub Actions и deploy-документация;
- актуальные продуктовые документы и предыдущие UI-аудиты;
- мобильный и desktop UX публичного сайта и CRM WebApp;
- негативные сценарии, права доступа, retry/reload/idempotency и observability.

## Roles

- потенциальный клиент;
- мастер/CRM-оператор;
- администратор контента;
- production-оператор.

## Non-goals

- несколько салонов и сложная ролевая модель;
- онлайн-оплата, автоматический календарь свободных слотов, рассылки и внешние CRM;
- замена SQLite на PostgreSQL без подтвержденной необходимости;
- live-deploy и операции с реальными Telegram credentials без отдельного доступа.

## Source of truth

- пользовательский запрос от 2026-07-11 имеет приоритет над `docs/current-review-boundaries.md`;
- целевой CRM-контракт задан `docs/crm-mvp-technical-spec.md`;
- публичное обещание сайта задано `docs/black-carp-mvp.md`;
- фактическое поведение определяется кодом и проверками.

## Verification constraints

- реальные `BOT_TOKEN`, webhook и Telegram session в репозитории отсутствуют;
- Telegram-интеграция должна проверяться локальным stub или детерминированными тестами;
- production host не изменяется в рамках аудита;
- визуальная проверка выполняется локально в реальном браузере на mobile и desktop viewport.

## Existing worktree state

До начала аудита в рабочем дереве уже были пользовательские изменения:

- modified: `script.js`;
- deleted: `assets/media/hero-forearm.png`, `assets/media/work-detail.png`, `assets/media/work-shoulder.png`;
- untracked: `docs/crm-mvp-technical-spec.md`, `docs/crm-system-map.html`.

Эти изменения сохраняются, не выдаются за работу аудита и не включаются в коммит аудита без необходимости.

## Prior audits

- `docs/audits/black-carp-mobile-ui-architecture-20260702/`;
- `docs/audits/black-carp-visual-20260702/`.

Их подтвержденные выводы проверяются на актуальном коде, а не дублируются без повторной валидации.
