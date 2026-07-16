# A02 — Telegram-бот: что ещё проверить

## Блокирующих неизвестных для Iteration 1 нет

Кодовые проблемы зафиксированы на commit `4fe2382`. Ниже — внешние и визуальные проверки, которые нельзя честно подтвердить текущим локальным прогоном. Параллельные uncommitted изменения product code требуют отдельной повторной проверки после определения их владельца и судьбы.

## Staging Telegram

1. В private chat клиента снять/записать payload и фактический UI для:
   - `/start` без кода;
   - валидного, неверного и повторного `/start <code>`;
   - `/start` уже `done`/`cancelled` заявки;
   - `/help`, `/status`, `/cancel`;
   - photo + caption, document, voice;
   - текстов 1999, 2000, 2001 и 4096 символов;
   - временного отказа `sendMessage` после успешной DB-привязки.
2. Проверить line wrapping, сканируемость plain-text master card, длину идеи, доступность inline button, системные safe areas и поведение Back в Telegram iOS/Android/Desktop.
3. Проверить WebApp deep link с валидным `initData`, неизвестным public code, медленной сетью и возвратом из CRM в Telegram.
4. Убедиться, что BotFather domain/WebApp settings соответствуют `CRM_WEBAPP_URL` и реальному `BOT_USERNAME`.

## Production configuration

- Не раскрывая секреты, установить тип каждого `MASTER_CHAT_IDS`: private user chat, group, supergroup или channel. Для group/supergroup inline `web_app` находится вне поддержанного Telegram контракта.
- Проверить, совпадают ли private `MASTER_CHAT_IDS` с пользователями из `MASTER_TELEGRAM_IDS` и у каждого ли адресата ранее начат private chat с ботом.
- Подтвердить фактический `BOT_USERNAME`; readiness сейчас не обнаруживает его отсутствие.
- Проверить, существуют ли у мастеров старые сообщения с callback-кнопками `Закрыть`/`Спам`; не нажимать их на production-данных до отдельного решения.
- Проверить backlog `notification_outbox`: `sending`, повторяющиеся `retry_wait`, ошибки типа invalid button/chat, число attempts по адресатам.

## Дополнительные локальные payload-тесты

Нужен расширенный Telegram stub, который сохраняет method и точный JSON каждого вызова и может независимо ломать:

- master `sendMessage` для новой заявки;
- master `sendMessage` для client comment;
- client acknowledgement;
- `answerCallbackQuery`.

Минимальные assertions:

- комментарий при полном отказе не имеет retryable outbox row;
- повторный deep link старой из двух заявок не меняет фактический routing в текущем коде;
- второй Telegram user перезаписывает `client_id`;
- terminal request всё ещё получает success copy;
- callback `close` из `new` даёт `cancelled`, `spam` — unknown;
- photo/caption фиксируется как `unknown` и не вызывает Bot API;
- >2000 символов молча режутся;
- crash/restart между Bot API success и `sent` создаёт повторный вызов.

Текущий `npm test` пройден: 7/7. Он использует локальный Telegram stub и не отправляет реальные сообщения, но не покрывает перечисленные UX payload. Дополнительный ad-hoc listener в этом прогоне не был разрешён средой, поэтому выводы о payload основаны на точной трассировке кода и существующем тестовом stub.

## Вопросы продукта

- Должен ли клиентский Telegram-канал вообще оставаться видимым после success screen, и если да — как он выбирает одну из нескольких заявок?
- Разрешена ли повторная привязка одной заявки к новому Telegram account, и какое подтверждение владения считается достаточным?
- Принимает ли бот только текст, или фото/документы должны становиться вложениями заявки?
- Как клиенту сообщать о `done`/`cancelled` и разрешены ли комментарии после terminal status?
- Должны ли комментарии храниться как полноценная переписка в CRM или бот остаётся одноразовым relay?
- Нужны ли несколько master recipients; если да, что означает `masterNotified:true`: хотя бы один или каждый обязательный адресат?
- Legacy callbacks считаются поддержанной совместимостью или должны быть недействительными после перехода на CRM?

## Границы доказательств

- Реальный production deploy, webhook state, `getWebhookInfo`, BotFather settings и содержимое Telegram history не проверялись.
- `.env` не читался, чтобы не раскрывать секреты; applicability условных configuration findings требует безопасной operational проверки.
- Визуального screenshot evidence Telegram UI нет; main agent может зафиксировать только сайт/CRM, пока staging bot не предоставлен.
