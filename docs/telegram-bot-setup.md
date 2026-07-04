# Black Carp — запуск бота на своем сервере

## Что используется

- `server.js` — сайт, API анкеты и Telegram webhook в одном Express-сервере.
- SQLite — файл БД `data/black-carp.sqlite`.
- `uploads/booking/` — локальное хранение эскизов и референсов.
- Telegram Bot API — `/start <code>` для клиента, уведомления мастеру и кнопки смены статуса.

## Локальный запуск

1. Создать `.env` на основе `.env.example`.
2. Заполнить:
   - `BOT_TOKEN`;
   - `BOT_USERNAME`;
   - `WEBHOOK_SECRET`;
   - `MASTER_CHAT_IDS`;
   - `SITE_URL`;
   - `ALLOWED_ORIGINS`.
3. Запустить:

```bash
npm run server
```

Сервер сам создаст:

- `data/black-carp.sqlite`;
- таблицы БД;
- `uploads/booking/`.

Локальная проверка:

```bash
node --check server.js
node --check script.js
curl http://127.0.0.1:3001/health
```

## Production

1. Залить проект на свой сервер.
2. Установить зависимости:

```bash
npm install --omit=dev
```

3. Создать `.env`.
4. Запустить через process manager:

```bash
PORT=3001 npm start
```

Для постоянной работы лучше использовать `pm2` или systemd.

## Nginx

Пример proxy:

```nginx
server {
  server_name your-domain.ru;

  location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

## Telegram webhook

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -d "url=https://your-domain.ru/telegram/webhook" \
  -d "secret_token=<WEBHOOK_SECRET>"
```

## Проверка API

```bash
curl -X POST https://your-domain.ru/api/booking/submit \
  -H "Content-Type: application/json" \
  -d '{"idempotencyKey":"test-1","consentAt":"2026-07-03T00:00:00.000Z","firstTattoo":"yes","hasSketch":false,"bodyZone":"Руки","bodySubzone":"Предплечье","bodyView":"front","sizePreset":"M","sizeCm":15,"ideaText":"Тестовая заявка","attachments":[]}'
```

Ожидаемый ответ:

```json
{
  "ok": true,
  "requestId": "req_...",
  "publicCode": "BC...",
  "telegramUrl": "https://t.me/blackcarp_bot?start=BC...",
  "masterNotified": false
}
```

`masterNotified: false` в этом ответе — нормальное текущее поведение. Мастер получает карточку после того, как клиент откроет Telegram по deep link и бот обработает `/start <code>`.

## Текущий поток заявки

1. Сайт отправляет анкету в `POST /api/booking/submit`.
2. Сервер сохраняет заявку в SQLite и файлы в `uploads/booking/`.
3. Сервер возвращает `telegramUrl`.
4. Клиент открывает Telegram.
5. Telegram присылает webhook `/start <code>`.
6. Сервер связывает клиента с заявкой и отправляет карточку мастеру.
7. Мастер меняет статус inline-кнопками.
