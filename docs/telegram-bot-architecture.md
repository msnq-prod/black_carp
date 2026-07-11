# Black Carp — архитектура CRM и бота

## Поток заявки

1. Клиент заполняет анкету и указывает контакт.
2. Backend атомарно сохраняет заявку, вложения, историю и outbox.
3. Клиент видит подтверждение на сайте; переход в Telegram не обязателен.
4. Бот сразу уведомляет мастера и открывает защищённую CRM WebApp.
5. Мастер меняет статус, планирует сеанс и ведёт заметки в CRM.
6. `/start <code>` дополнительно связывает заявку с Telegram-профилем клиента.

## Данные

- `booking_requests` — анкета, контакт, статус и планирование;
- `booking_attachments` — метаданные приватных файлов;
- `status_history` — история переходов;
- `crm_notes`, `crm_activity` — заметки и журнал действий;
- `notification_outbox` — гарантированная доставка уведомлений;
- `telegram_updates` — ранняя дедупликация webhook.

Статусы: `new`, `in_review`, `need_details`, `approved`, `scheduled`, `done`, `cancelled`. Переходы проверяются сервером.

## Защита

- CRM проверяет подпись Telegram `initData`, срок авторизации и allowlist мастеров;
- webhook требует `X-Telegram-Bot-Api-Secret-Token`;
- вложения доступны только через авторизованный CRM endpoint;
- файлы не раздаются как публичная статика;
- лимит вложения задаётся `MAX_ATTACHMENT_BYTES`;
- токены и персональные данные не включаются в ответы healthcheck.

## API CRM

- `GET /api/crm/me`;
- `GET /api/crm/requests`;
- `GET /api/crm/requests/:id`;
- `PATCH /api/crm/requests/:id/status`;
- `PATCH /api/crm/requests/:id/schedule`;
- `POST /api/crm/requests/:id/notes`;
- `GET /api/crm/requests/:id/attachments/:attachmentId`.

Все CRM endpoints требуют заголовок `X-Telegram-Init-Data`.
