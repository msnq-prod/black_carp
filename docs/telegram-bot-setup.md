# Black Carp — запуск backend, бота и CRM

## Состав

- сайт и анкета: `/`;
- CRM Telegram WebApp: `/crm`;
- API заявок и CRM: `/api`;
- webhook бота: `/telegram/webhook`;
- SQLite: `data/black-carp.sqlite`;
- приватные вложения: `uploads/booking/`.

Требуется Node.js 22 из `.nvmrc`.

## Локальный запуск

```bash
cp .env.example .env
npm ci
npm run check
npm test
npm start
```

Обязательные настройки: `BOT_TOKEN`, `BOT_USERNAME`, `WEBHOOK_SECRET`, `MASTER_CHAT_IDS`, `MASTER_TELEGRAM_IDS`, `CRM_WEBAPP_URL`, `SITE_URL`, `ALLOWED_ORIGINS`.

- `MASTER_CHAT_IDS` — чаты, куда бот отправляет новые заявки.
- `MASTER_TELEGRAM_IDS` — Telegram user ID мастеров с доступом в CRM.
- `CRM_WEBAPP_URL` — публичный HTTPS URL вида `https://domain.ru/crm`.

## Telegram

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -d "url=https://domain.ru/telegram/webhook" \
  -d "secret_token=<WEBHOOK_SECRET>"
```

Новая заявка сразу сохраняется и ставится в очередь уведомлений. Telegram-сбой не теряет заявку: outbox повторяет доставку. В сообщении мастеру есть кнопка `Открыть CRM`.

## Production

- собирать backend из `Dockerfile` или `docker-compose.production.example.yml`;
- проксировать весь домен на `127.0.0.1:3001` с HTTPS;
- не публиковать `data/` и `uploads/`;
- ежедневно бэкапить SQLite и uploads;
- перед релизом выполнять `npm ci && npm run check && npm test`.

Host-level deploy остаётся ограниченной инфраструктурной границей `/usr/local/bin/black-carp-deploy`; workflow сначала запускает проверки и только затем вызывает этот скрипт. `ops/backup.sh` создаёт согласованный SQLite backup и архив uploads; его нужно запускать ежедневным cron/system timer на хосте.

Проверка:

```bash
curl https://domain.ru/health
```

Ожидается `{"ok":true,"service":"black-carp","database":"ready"}`.
