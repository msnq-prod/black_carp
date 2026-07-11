# Black Carp — deploy через Caddy Docker

## Текущее подтвержденное состояние

Продакшен-хост: `root@79.141.77.238`.

На сервере уже есть общий Docker Compose stack с Caddy. Он обслуживает не только `black-carp.art`, поэтому изменения нужно держать строго в зоне Black Carp и не трогать конфигурацию `zagarami.com` без отдельной задачи.

Подтвержденная ранее схема:

- compose-файл: `/root/apps/stones/docker-compose.prod.yml`;
- Caddyfile: `/root/apps/stones/docker/Caddyfile`;
- Caddy-контейнер: `stones-caddy-1`;
- Caddy root для Black Carp внутри контейнера: `/data/black-carp`;
- файл в Docker volume: `/media/system/docker/volumes/stones_caddy_data/_data/black-carp/index.html`.

Отдельно был назван путь `/data/black-carp/index.html`, но перед следующей заменой файла нужно заново проверить текущий mount на сервере.

## Что деплоится сейчас

Текущий проект уже не только статическая страница. В репозитории есть:

- `index.html`, `styles.css`, `script.js` — сайт и booking wizard;
- `server.js` — Express-сервер, API анкеты и Telegram webhook;
- `.env.example` — пример runtime-настроек;
- `data/` — SQLite-файл создается сервером локально;
- `uploads/booking/` — вложения заявок создаются сервером локально.

Для полноценной работы записи нужен Node.js backend, а не только статическая раздача `index.html`.

## Backend запуск

```bash
npm install --omit=dev
npm start
```

Воспроизводимая backend-сборка находится в `Dockerfile`, локальный production-пример — в `docker-compose.production.example.yml`. Ежедневный backup SQLite и uploads выполняется `ops/backup.sh` из host cron/system timer.

Минимальные env-переменные:

```text
PORT=3001
SITE_URL=https://black-carp.art
BOT_TOKEN=...
BOT_USERNAME=blackcarp_bot
WEBHOOK_SECRET=...
MASTER_CHAT_IDS=...
MASTER_TELEGRAM_IDS=...
CRM_WEBAPP_URL=https://black-carp.art/crm
HOST=0.0.0.0
DB_PATH=./data/black-carp.sqlite
JSON_LIMIT=25mb
ALLOWED_ORIGINS=https://black-carp.art,https://www.black-carp.art
TELEGRAM_API_BASE=https://api.telegram.org
```

## Caddy

Если backend запущен на `127.0.0.1:3001`, Black Carp должен проксироваться в Node.js:

```caddy
black-carp.art, www.black-carp.art {
  reverse_proxy 127.0.0.1:3001
}
```

Если нужно оставить только статический placeholder, используется `root * /data/black-carp` и `file_server`, но booking API и Telegram webhook в таком режиме работать не будут.

## Проверка после деплоя

```bash
curl -I https://black-carp.art/
curl https://black-carp.art/health
curl -X POST https://black-carp.art/api/booking/submit \
  -H "Content-Type: application/json" \
  -d '{"idempotencyKey":"deploy-test-1","consentAt":"2026-07-04T00:00:00.000Z","firstTattoo":"yes","hasSketch":false,"bodyZone":"Руки","bodySubzone":"Предплечье","bodyView":"front","sizePreset":"M","sizeCm":15,"ideaText":"Тестовая заявка","clientName":"Тест","contactType":"telegram","contactValue":"@test","attachments":[]}'
```

Telegram webhook:

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -d "url=https://black-carp.art/telegram/webhook" \
  -d "secret_token=<WEBHOOK_SECRET>"
```

## Важно

Перед деплоем GitHub Actions выполняет `npm ci`, syntax-check и интеграционные тесты. Сам серверный deploy-скрипт и Caddy-конфигурацию нужно проверять отдельно на хосте перед первым релизом CRM.
