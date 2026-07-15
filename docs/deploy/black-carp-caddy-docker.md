# Black Carp — deploy через Caddy Docker

## Текущее подтвержденное состояние

Продакшен-хост: задаётся секретами GitHub Actions; реальные адреса и пути не хранятся в репозитории.

На сервере уже есть общий Docker Compose stack с Caddy. Он обслуживает не только `black-carp.art`, поэтому изменения нужно держать строго в зоне Black Carp и не трогать конфигурацию `zagarami.com` без отдельной задачи.

Подтвержденная ранее схема:

- compose-файл: `<host-compose-file>`;
- Caddyfile: `<host-caddyfile>`;
- Caddy-контейнер: `<caddy-container>`;
- Caddy root для Black Carp внутри контейнера: `<caddy-root>`.

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
npm ci --omit=dev
npm start
```

Воспроизводимая backend-сборка находится в `Dockerfile`, локальный production-пример — в `docker-compose.production.example.yml`. Ежедневный backup SQLite и uploads выполняется `ops/backup.sh` из host cron/system timer.

Compose запускает отдельный одноразовый `black-carp-init` от root только для назначения владельца bind mounts. Само приложение работает с UID/GID выделенного пользователя из `BLACK_CARP_UID`/`BLACK_CARP_GID`, с read-only root filesystem и правами записи только в `data/`, `uploads/` и `/tmp`.

Перед запуском задаются release SHA и абсолютные host paths:

```bash
export BLACK_CARP_RELEASE_SHA="$(git rev-parse HEAD)"
export BLACK_CARP_IMAGE="ghcr.io/<owner>/<image>@sha256:<verified-digest>"
export BLACK_CARP_DATA_DIR=/srv/data/black-carp
export BLACK_CARP_UPLOADS_DIR=/srv/uploads/black-carp
export BLACK_CARP_ENV_FILE=/srv/config/black-carp.env
export BLACK_CARP_UID="$(id -u black-carp)"
export BLACK_CARP_GID="$(id -g black-carp)"
docker compose -f docker-compose.production.example.yml config --quiet
docker compose -f docker-compose.production.example.yml pull
docker compose -f docker-compose.production.example.yml up -d --no-build
```

Обычный `docker compose config` использовать в логах нельзя: он раскрывает значения из `env_file`. Для проверки применяется только `config --quiet`.

Минимальные env-переменные:

```text
PORT=3001
TRUST_PROXY=172.30.0.0/24
SITE_URL=https://black-carp.art
BOT_TOKEN=...
BOT_USERNAME=blackcarp_bot
WEBHOOK_SECRET=...
DEPLOY_PROBE_TOKEN=...
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

Поддерживаемый production-контракт — один Caddy proxy hop и общая external Docker network. Backend публикуется на host loopback только для локального smoke, а Caddy обращается к service DNS.

```bash
docker network create --subnet 172.30.0.0/24 black-carp-edge  # один раз
export BLACK_CARP_DOCKER_NETWORK=black-carp-edge
export BLACK_CARP_DOCKER_NETWORK_EXTERNAL=true
```

Эту же сеть нужно подключить к Caddy service в его compose-файле. Caddyfile:

```caddy
black-carp.art, www.black-carp.art {
  reverse_proxy black-carp:3001
}
```

`TRUST_PROXY` должен точно совпадать с выделенным CIDR external network; значения `true` и числовой hop count запрещены. В эту сеть нельзя подключать недоверенные контейнеры. Порт `3001` нельзя публиковать наружу. Схема `127.0.0.1:3001` внутри Caddy-контейнера не поддерживается: loopback контейнера не является host loopback.

Для smoke candidate используется отдельный `docker-compose.production.candidate.example.yml`. Он имеет другие service names, loopback-порт, сеть, каталоги и env-файл, поэтому не попадает в live Caddy upstream и не может изменить production SQLite/uploads. Candidate проверяет image и runtime, но не принимает реальные заявки и не вызывает Telegram readiness. Пример параметров:

```bash
export COMPOSE_PROJECT_NAME=black-carp-candidate
export BLACK_CARP_RELEASE_SHA=<40-char-sha>
export BLACK_CARP_CANDIDATE_BIND_PORT=3002
export BLACK_CARP_CANDIDATE_DOCKER_NETWORK=black-carp-candidate-<sha>
export BLACK_CARP_CANDIDATE_DATA_DIR=/srv/releases/<sha>/candidate-data
export BLACK_CARP_CANDIDATE_UPLOADS_DIR=/srv/releases/<sha>/candidate-uploads
export BLACK_CARP_CANDIDATE_ENV_FILE=/srv/releases/<sha>/candidate.env
docker compose -f docker-compose.production.candidate.example.yml up -d
```

После candidate health/UI smoke stack удаляется. SQLite и локальные uploads не допускают безопасный blue-green с двумя writable-копиями: перед финальным cutover host script блокирует новые записи, создаёт свежий проверенный backup, останавливает старый app и запускает новый image с единственными live bind mounts. Это контролируемый stop/start с коротким окном недоступности; zero-downtime для текущего storage не заявляется.

Если нужно оставить только статический placeholder, используется `root * /data/black-carp` и `file_server`, но booking API, CRM и Telegram webhook в таком режиме работать не будут.

## Проверка после деплоя

```bash
curl -I https://black-carp.art/
curl https://black-carp.art/health
RELEASE_SHA="$(git rev-parse HEAD)"
curl -X POST https://black-carp.art/api/booking/submit \
  -H "Content-Type: application/json" \
  -d "{\"idempotencyKey\":\"deploy-${RELEASE_SHA}-$(date -u +%s)\",\"consentAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"firstTattoo\":\"yes\",\"hasSketch\":false,\"bodyZone\":\"Руки\",\"bodySubzone\":\"Предплечье\",\"bodyView\":\"front\",\"sizePreset\":\"M\",\"sizeCm\":15,\"ideaText\":\"Production smoke ${RELEASE_SHA}\",\"clientName\":\"Release smoke\",\"contactType\":\"telegram\",\"contactValue\":\"@blackcarp_smoke\",\"attachments\":[]}"
```

Smoke создаёт реальную заявку и уведомление. После проверки её нужно пометить `cancelled`; повторный smoke всегда использует новый idempotency key.

Telegram webhook:

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -d "url=https://black-carp.art/telegram/webhook" \
  -d "secret_token=<WEBHOOK_SECRET>"
```

## Важно

`/usr/local/bin/black-carp-deploy <40-char-sha>` обязан развернуть ровно переданный commit: получить заранее собранный `BLACK_CARP_IMAGE` по digest (без rebuild на host), проверить его OCI revision label и `/app/REVISION`, создать и проверить backup, запустить изолированный candidate и выполнить health/UI smoke. Затем он переводит Caddy в maintenance, создаёт свежий backup, удаляет candidate, останавливает старый app и запускает новый image с единственными live bind mounts. Скрипт обязан поставить trap и самостоятельно вернуть предыдущую ревизию при любом обрыве cutover. Предыдущий image и backup сохраняются для rollback. `/usr/local/bin/black-carp-rollback <failed-sha>` обязан быть идемпотентным: ничего не менять, если failed SHA не был активирован, иначе вернуть предыдущую подтверждённую ревизию. Эти host scripts находятся вне репозитория и должны быть обновлены до включения workflow.

Backup запускается не от root, а от выделенного пользователя `black-carp`; его UID/GID передаются Compose через `BLACK_CARP_UID`/`BLACK_CARP_GID`, поэтому он читает закрытые bind mounts. Cron явно задаёт production-пути `/srv/data/black-carp/black-carp.sqlite` и `/srv/uploads/black-carp`. `ops/backup.sh` сериализует запуски, проверяет SQLite, создаёт checksum и выполняет пробное восстановление. `BLACK_CARP_BACKUP_HOOK` может указывать на root-owned executable, который получает три аргумента — SQLite, uploads archive и checksum — и отправляет их в зашифрованное off-host хранилище.

```bash
sudo install -d -o black-carp -g black-carp -m 700 /srv/backups/black-carp
sudo install -m 0644 ops/black-carp-backup.cron.example /etc/cron.d/black-carp-backup
ops/verify-restore.sh BACKUP.sqlite UPLOADS.tar.gz BACKUP.sha256
```

Перед деплоем GitHub Actions выполняет Node tests, backup/restore smoke и Docker runtime smoke. Первый release остаётся заблокирован до проверки external network, SSH fingerprint, host deploy/rollback scripts, off-host backup и реального Telegram WebApp.
