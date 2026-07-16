# A02 — Telegram-бот: durable solution plan

План основан на baseline `4fe2382` и текущем uncommitted WIP-снимке 2026-07-12. Product code в рамках аудита не менялся.

## Scope после WIP

- Baseline: 18 findings — 6 P1, 8 P2, 4 P3.
- Текущий WIP: 1 `fixed-by-WIP`, 3 `partially-addressed`, 13 `still-open`, 1 `needs-runtime/live-Telegram`.
- Remaining: 17 findings — 5 P1, 8 P2, 4 P3.
- `P1-A02-02` не перепланируется: durable outbox клиентских комментариев уже реализован и regression-tested в WIP. Дальше он используется как готовая основа.

## Целевой контракт

1. Telegram остаётся необязательным текстовым каналом уточнений; основная заявка создаётся на сайте, операционная работа идёт в CRM.
2. `publicCode` — отображаемый номер, не credential владения.
3. Любое клиентское сообщение связано с явно выбранной заявкой; «последняя по времени» не является источником истины.
4. Бот не меняет master status. Старые callback-кнопки безопасно устаревают и ведут в CRM.
5. Actionable master WebApp поддерживается только в проверенном private chat. Групповой канал, если нужен, является отдельным read-only transport.
6. Все durable outbound события имеют стабильный event/delivery id. Telegram-доставка считается at-least-once; UI и операционный процесс выдерживают повтор.
7. Неподдержанный payload получает явный ответ. Silent drop и silent truncation запрещены.

## Последовательность

### 1. Сначала обезвредить legacy status callbacks

Findings: `P1-A02-06`.

- Прекратить status mutation для legacy actions `review`, `details`, `offer`, `close`, `spam`.
- На любой старый callback отвечать: кнопка устарела, статус не изменён, откройте заявку в CRM.
- Если callback содержит доступный request id, отправлять/обновлять безопасную кнопку входа в конкретную CRM-карточку; отсутствие такой возможности не должно возвращать mutation.
- Namespaces будущих client callbacks и service callbacks версионировать (`client:v1:*`, `service:v1:*`) и не смешивать с legacy master actions.
- Удалить happy-path тест, который считает Telegram callback вторым master CRM. Вместо него зафиксировать, что `close`/`spam`/`review` не меняют row и status history.

Acceptance:

- старая кнопка `Закрыть` при любом текущем status оставляет status неизменным;
- callback всегда получает понятный ответ;
- единственная write-поверхность master status — CRM API.

### 2. Разделить номер заявки и Telegram identity proof

Findings: `P1-A02-01`, `P1-A02-04`, `P3-A02-01`, `P3-A02-02`.

- Ввести отдельный случайный versioned link token длиной до Telegram deep-link limit; хранить только hash, request id, срок, claimant, consumed/revoked timestamps.
- Deep link должен содержать token, а не публичный номер заявки. `publicCode` остаётся только в текстах и UI.
- Первый claim выполнять атомарно. Повтор тем же Telegram user идемпотентен и обновляет active request без второго `telegram_linked`; другой user не получает владение.
- Законная смена Telegram account проходит через отдельный audited recovery: подтверждение мастером/по сохранённому контакту, revoke старого token, выпуск нового. Silent overwrite не разрешать.
- На success screen показать дополнительную кнопку `Написать в Telegram` только при наличии backend URL. Рядом явно сказать: мастер уже получил заявку, Telegram необязателен.
- Общий footer link не должен притворяться ссылкой текущей заявки. При наличии локальной заявки он может вести по сохранённому request-specific link; иначе — в help/start без обещания связи.
- Валидный `/start` отвечает номером и локализованным текущим status; повтор сообщает «уже связано». Invalid/expired token не предлагает сразу создавать duplicate, а даёт проверку ссылки, профиль последней заявки и новый старт как отдельную опцию.

Data/rollout:

- старые `?start=<publicCode>` временно принимать только в compatibility read path без смены уже существующего owner;
- после выпуска token links отключить legacy claim и оставить понятный ответ об устаревшей ссылке;
- migration должна сохранять текущие client bindings и activity.

### 3. Сделать routing комментариев request-scoped

Findings: `P1-A02-03`, `P2-A02-02`, `P2-A02-03`, `P3-A02-04`.

- Хранить bot session/active request для Telegram user/chat отдельно от `telegram_opened_at` аналитики.
- Каждый успешный `/start <token>` обновляет active request, включая повторное открытие ранее связанной заявки.
- Если live-заявка одна, `/status` и новый комментарий могут использовать её. Если live-заявок несколько и active context не задан, бот сначала просит выбрать номер; не угадывает.
- Ответ на успешную привязку всегда показывает request code и status, чтобы клиент видел контекст следующего текста.
- Для `done`/`cancelled` выдавать lifecycle-specific текст. Не пересылать обычный комментарий в terminal request без явного подтверждённого сценария reopen/support.
- Команды парсить точно: `/start`, `/start@bot`, `/help`, `/status`; `/starter` и неизвестные команды не должны попадать в comment relay.
- Для Telegram user из master allowlist обычный text не считать клиентским. Отвечать короткой подсказкой открыть CRM.

Acceptance:

- последовательность `start A -> start B -> start A -> text` отправляет text только в A;
- при двух заявках без context нет автоматической отправки;
- `/help`/`/status` не создают `client_message` activity/outbox;
- terminal request не получает ложное «мастер скоро свяжется».

### 4. Зафиксировать payload contract

Findings: `P2-A02-04`, `P2-A02-05`, `P2-A02-06`, `P3-A02-03`.

Recommended MVP: text-only Telegram clarification.

- В `/start` явно написать «дополнительный текстовый комментарий» и допустимую длину.
- Photo/document/voice/sticker/caption должны получать unsupported-content ответ с безопасным следующим шагом. Если product решит принимать Telegram media, это отдельный attachment-ingestion scope с Bot API download, mime/size validation, malware/retention policy и request-scoped storage; не включать его неявно.
- Длинный text не обрезать. До записи проверить лимит и попросить сократить/разбить; text в activity и outbox обязан совпадать с подтверждённым пользователю.
- Follow-up master notification должен содержать кнопку конкретной CRM-заявки и stable request code.
- CRM timeline показывает текст клиентского сообщения, actor, delivery state и время; ошибки доставки не должны скрываться за одним label.
- Master new-request card дополняется `contactType`, `contactComment`, `sketchComment`; размер форматируется честно при preset-only/cm-only/empty.

### 5. Ограничить actionable master notifications private chat

Findings: `P1-A02-05`, `P2-A02-08`.

- Для actionable recipients использовать private Telegram user chats. Предпочтительно выводить их из `MASTER_TELEGRAM_IDS`, потому что private chat id пользователя равен его Telegram user id; отдельный `MASTER_CHAT_IDS` оставить только при явной необходимости.
- На startup/deploy валидировать формат recipient ids; перед release выполнить Bot API `getChat` preflight и подтвердить `type=private`, что user начал диалог с ботом, а token принадлежит ожидаемому `BOT_USERNAME`.
- Group/supergroup, если нужен как мониторинговый канал, получает отдельный read-only payload без неподдержанного `web_app`; переход в авторизованную CRM проектируется и live-проверяется отдельно.
- Readiness в production требует `BOT_USERNAME` и `CRM_WEBAPP_URL`, проверяет username syntax, URL parse и HTTPS. Staging preflight через `getMe` подтверждает соответствие token/username.
- Неверный recipient type/config error не должен бесконечно выглядеть как transient retry: отличать permanent delivery failure и показывать его в CRM operational inbox.

Acceptance:

- missing/wrong `BOT_USERNAME`, non-HTTPS CRM URL и неподдержанный recipient contract делают release/readiness красным;
- private master получает карточку, кнопка открывает exact request с валидным initData;
- group configuration не проходит как поддержанный actionable path без отдельного live-approved варианта.

### 6. Довести outbound feedback и duplicate tolerance

Findings: `P2-A02-01`, `P2-A02-07`; использует уже закрытый WIP для `P1-A02-02`.

- Для state-changing `/start` сохранять клиентское подтверждение как outbound job в той же transaction, что link/session update. Webhook success означает «ответ поставлен в durable queue», а не «best-effort send вызван».
- Для comment acknowledgement сохранять correlation с master delivery, чтобы текст `передан`/`в очереди` соответствовал фактам; не обещать будущую доставку без job.
- Legacy callback больше не меняет state, поэтому failure `answerCallbackQuery` не создаёт скрытую mutation. Ошибку всё равно наблюдать метрикой.
- Добавить stable `delivery_key`/unique constraint для logical event + recipient; повтор worker не создаёт вторую outbox row.
- Сохранить Telegram `message_id` при известном success. Для recovered stale claim признать неопределённый outcome: выбрать at-least-once и маркировать resend как `Повтор доставки` с тем же public code/event id.
- CRM остаётся canonical: повторное Telegram-сообщение никогда не создаёт вторую booking row.
- Ограничить retry policy: permanent errors уходят в failed/action-required, transient — в bounded backoff; мастер видит recipient, attempts, last error и manual retry.

Важно: Telegram Bot API не даёт application idempotency key для `sendMessage`; exactly-once в crash window недоказуем. Требование должно быть duplicate-tolerant at-least-once, а не ложное exactly-once.

### 7. Закрыть test и live gaps

Findings: все remaining; отдельно `P1-A02-05`.

Local stub assertions:

- exact `/start` payload/copy/buttons: missing, invalid, expired, first claim, same-user repeat, foreign user, terminal status;
- two-request active routing и отсутствие implicit routing;
- `/help`, `/status`, unknown command, master text;
- photo + caption, document, voice;
- text 1999/2000/2001/4096 без silent truncation;
- client/master/service send failures независимо;
- legacy callbacks не меняют status;
- exact WebApp URL/comment reply markup/card fields;
- missing username/invalid CRM URL/permanent recipient failure;
- concurrent retry, stale claim и injected `Telegram accepted -> process dies before sent`;
- migration/readback link tokens, active sessions, delivery keys.

Browser/cross-area:

- success CTA остаётся secondary и явно необязательной;
- profile/status recovery не создаёт duplicate;
- CRM timeline показывает comment payload и delivery state;
- operational inbox различает transient/permanent failure.

Live Telegram release gate:

- private client и private master на iOS, Android, Desktop;
- WebApp open/back, exact deep link, initData и BotFather domain;
- blocked bot/unstarted private chat;
- намеренно неподдержанный group path;
- line wrapping длинной карточки и accessibility Telegram UI;
- `getMe`, `getChat`, `getWebhookInfo`, один реальный staging comment retry.

## Definition of done

- Все 5 remaining P1 закрыты кодом, regression tests и требуемым live evidence.
- Ни один text/media/command update не исчезает молча и не меняет чужую/неявную заявку.
- Public code нигде не используется как повторно применимый owner credential.
- Старые Telegram master buttons не меняют status.
- Actionable CRM button работает только в явно поддержанном private-chat contract.
- Delivery semantics документированы как durable, request-scoped, observable и duplicate-tolerant.
