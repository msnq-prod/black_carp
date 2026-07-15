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

Обязательные настройки: `BOT_TOKEN`, `BOT_USERNAME`, `WEBHOOK_SECRET`, `DEPLOY_PROBE_TOKEN`, `MASTER_CHAT_IDS`, `MASTER_TELEGRAM_IDS`, `CRM_WEBAPP_URL`, `SITE_URL`, `ALLOWED_ORIGINS`, `TRUST_PROXY`.

- `MASTER_CHAT_IDS` — чаты, куда бот отправляет новые заявки.
- `MASTER_TELEGRAM_IDS` — Telegram user ID мастеров с доступом в CRM.
- `CRM_WEBAPP_URL` — публичный HTTPS URL вида `https://domain.ru/crm`.
- `TRUST_PROXY` — точный CIDR закрытой external network, общей только для backend и Caddy; `true` и числовой hop count запрещены.

## Telegram

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -d "url=https://domain.ru/telegram/webhook" \
  -d "secret_token=<WEBHOOK_SECRET>"
```

Новая заявка сразу сохраняется и ставится в очередь уведомлений. Telegram-сбой не теряет заявку: outbox повторяет доставку. В сообщении мастеру есть кнопка `Открыть CRM`.

## Production

- собирать backend из `Dockerfile` или `docker-compose.production.example.yml`;
- подключить backend и Caddy к одной external Docker network и проксировать на `black-carp:3001` с HTTPS;
- не публиковать `data/` и `uploads/`;
- ежедневно бэкапить SQLite и uploads;
- перед релизом выполнять `npm ci && npm run check && npm test`.

Host-level deploy остаётся ограниченной инфраструктурной границей `/usr/local/bin/black-carp-deploy <sha>`; workflow передаёт точный проверенный commit и запрещает отмену активного deploy. Скрипт обязан выполнить backup, candidate smoke и атомарное переключение. При внешнем smoke failure workflow вызывает `/usr/local/bin/black-carp-rollback <sha>`.

`ops/backup.sh` создаёт согласованный SQLite backup и архив uploads, checksum и пробное восстановление. Его нужно запускать от выделенного пользователя `black-carp`, а не root, с явными `BLACK_CARP_DB_PATH=/srv/data/black-carp/black-carp.sqlite` и `BLACK_CARP_UPLOADS_PATH=/srv/uploads/black-carp`. Для off-host копии задаётся исполняемый `BLACK_CARP_BACKUP_HOOK`; hook получает пути к SQLite, uploads archive и checksum.

```bash
BLACK_CARP_NODE_BIN=/absolute/path/to/node22 \
BLACK_CARP_APP_DIR=/srv/www/black-carp \
BLACK_CARP_BACKUP_DIR=/srv/backups/black-carp \
BLACK_CARP_DB_PATH=/srv/data/black-carp/black-carp.sqlite \
BLACK_CARP_UPLOADS_PATH=/srv/uploads/black-carp \
./ops/backup.sh

./ops/verify-restore.sh \
  /srv/backups/black-carp/black-carp-TIMESTAMP.sqlite \
  /srv/backups/black-carp/black-carp-uploads-TIMESTAMP.tar.gz \
  /srv/backups/black-carp/black-carp-TIMESTAMP.sha256
```

Compose запускает root init только для назначения владельца bind mounts; основной контейнер работает с UID/GID выделенного пользователя `black-carp`, переданными через `BLACK_CARP_UID`/`BLACK_CARP_GID`. Проверять compose безопасно только через `docker compose ... config --quiet`: обычный вывод раскрывает `env_file`.

Проверка:

```bash
curl https://domain.ru/health
```

Ожидается `{"ok":true,"service":"black-carp","release":"<40-char-sha>","database":"ready"}`. Deploy дополнительно вызывает защищённый `/api/ops/readiness`, который сверяет embedded revision, Telegram token, webhook URL и доступ к чатам мастеров.
