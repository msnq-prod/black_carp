# A02 — Telegram-бот: проблемы Iteration 1

Baseline: commit `4fe2382`; `file:line` ниже относятся к нему. P0 не подтверждены. Ниже подтверждённое отделено от условных production-рисков; параллельные uncommitted правки product code не учитывались.

## P1

### P1-A02-01: Клиентский `/start <code>` недоступен из текущего success flow

- **Promise:** Telegram необязателен, но клиент может перейти по deep link, связать заявку и отправлять дополнительные комментарии.
- **Reality:** backend возвращает и сайт сохраняет `telegramUrl`, однако экран успеха не показывает Telegram CTA. Видимая ссылка в шапке открывает бота без кода; бот отправляет только назад к анкете.
- **Evidence:** `server.js:164-170`, `script.js:1182-1187`, `index.html:103-106`, `index.html:435-440`, `server.js:386-396`; promise — `docs/telegram-bot-architecture.md:5-10`.
- **Effect:** функция привязки и клиентских комментариев практически скрыта; клиент, только что заполнивший анкету и открывший общий bot link, попадает в цикл «заполните анкету».
- **Cause:** deep link остался в API/storage, но был удалён из видимого success state; старые helper-функции не вызываются.
- **Status:** confirmed.

### P1-A02-02: При сбое комментария клиенту обещают несуществующую повторную доставку

- **Promise:** «Комментарий сохранён. Мастер увидит его, когда связь восстановится» означает, что сообщение будет автоматически доставлено или доступно мастеру.
- **Reality:** клиентские комментарии отправляются best-effort вне outbox. При полном отказе сохраняется только `crm_activity.payload`, повторной отправки нет; CRM timeline показывает лишь событие без текста.
- **Evidence:** `server.js:462-470`, `server.js:555-561`, `server.js:1318-1364`, `crm/app.js:16-22`, `crm/app.js:95-99`.
- **Effect:** важное уточнение может никогда не попасть мастеру, хотя клиент получил прямое обещание обратного.
- **Cause:** журнал аудита используется как суррогат сохранения сообщения, но не связан ни с delivery worker, ни с читаемым представлением payload в CRM.
- **Status:** confirmed.

### P1-A02-03: При нескольких заявках комментарий может попасть не в ту заявку

- **Promise:** сообщение после открытия deep link относится к выбранной заявке.
- **Reality:** бот не хранит явный active request и выбирает одну заявку по `ORDER BY COALESCE(telegram_opened_at, created_at)`. `telegram_opened_at` задаётся только при первом открытии, поэтому повторный `/start` старой заявки не переключает контекст обратно.
- **Evidence:** `server.js:407-414`, `server.js:447-453`, `server.js:462-470`.
- **Effect:** описание, медицинское/личное уточнение или изменение идеи фиксируется и показывается мастеру под другим проектом клиента.
- **Cause:** скрытое правило «последнее первое открытие» заменяет явную привязку сообщения к request code.
- **Status:** confirmed.

### P1-A02-04: Public code позволяет перепривязать заявку к другому Telegram user

- **Promise:** `/start <code>` связывает владельца заявки с его Telegram-профилем.
- **Reality:** любой Telegram user, получивший код, без подтверждения и без проверки существующей связи перезаписывает `booking_requests.client_id`. Тот же путь доступен разрешённому мастеру.
- **Evidence:** `server.js:399-415`, `server.js:589-617`, `server.js:750-776`.
- **Effect:** прежний клиент теряет корректный маршрут сообщений, новый аккаунт получает возможность писать от имени владельца заявки; смена телефона/аккаунта выглядит как необъяснимый разрыв связи.
- **Cause:** public code одновременно является номером заявки и многократно используемым bearer credential для смены владельца.
- **Status:** confirmed in code; abuse requires code disclosure or an accidental open from another account.

### P1-A02-05: Master WebApp-кнопка несовместима с разрешённой конфигурацией group chat

- **Promise:** каждый `MASTER_CHAT_IDS` получает карточку с рабочей кнопкой входа в CRM.
- **Reality:** код допускает произвольные chat IDs и всегда прикрепляет inline `web_app`. Telegram Bot API ограничивает этот тип кнопки private chat между пользователем и ботом; тип chat не валидируется и fallback URL-кнопки нет.
- **Evidence:** `server.js:541-552`, `server.js:906-910`, `server.js:1318-1328`, `docs/telegram-bot-setup.md:24-28`; Telegram Bot API, `InlineKeyboardButton.web_app`: https://core.telegram.org/bots/api#inlinekeyboardbutton.
- **Effect:** при master group/supergroup actionable entry в CRM не поддерживается; send может быть отклонён и бесконечно оставаться в retry, либо карточка останется без работающего входа.
- **Cause:** notification destination contract не ограничен private user chats, а markup не адаптируется к типу назначения.
- **Status:** confirmed conditional incompatibility; actual production chat types are not verified.

### P1-A02-06: Старые callback-кнопки продолжают менять статусы с новой семантикой

- **Promise:** бот после CRM-релиза только уведомляет и открывает WebApp; статусы управляются в CRM.
- **Reality:** legacy callback handler жив. В ранее отправленных сообщениях кнопка `Закрыть` несла action `close` и означала legacy `closed`; теперь тот же action переводит заявку в terminal `cancelled`. Старая кнопка `Спам` теперь отвечает «Неизвестное действие».
- **Evidence:** `docs/crm-mvp-technical-spec.md:50-59`, `server.js:474-511`, `server.js:541-552`, `test/crm.integration.test.js:81-82`; historical payload/mapping — `d1fa82c:server.js:326-404`; legacy migration meanings — `server.js:1028-1039`.
- **Effect:** нажатие старого `Закрыть` может необратимо отменить живую заявку вместо завершения; Telegram и CRM становятся конкурирующими поверхностями управления.
- **Cause:** state-changing legacy endpoint оставлен активным после миграции enum и удаления callback-кнопок из новых сообщений.
- **Status:** confirmed in current code and repository history; presence of such messages in production Telegram history is unverified.

## P2

### P2-A02-01: Ошибка сервисного ответа теряется после уже применённого действия

- **Promise:** после `/start` клиент видит подтверждение, после callback мастер видит результат.
- **Reality:** `sendTelegramMessage()` возвращает ошибку, но `/start` и подтверждение комментария её игнорируют; `answerCallbackQuery()` поглощает ошибку. Webhook всё равно помечается завершённым и следующий тот же `update_id` дедуплицируется.
- **Evidence:** `server.js:323-329`, `server.js:407-430`, `server.js:469-470`, `server.js:564-586`.
- **Effect:** связь или статус уже изменены, но пользователь видит тишину/spinner и не знает, нужно ли повторять действие.
- **Cause:** доставка UX-ответа не является частью outcome webhook event.
- **Status:** confirmed.

### P2-A02-02: `/start` и комментарии не учитывают terminal status

- **Promise:** сервисный текст объясняет актуальное состояние и следующий шаг.
- **Reality:** `handleStart()` для `done`/`cancelled` отвечает «Мастер скоро свяжется»; `handleClientMessage()` также отправляет комментарии в terminal request без предупреждения.
- **Evidence:** `server.js:399-430`, `server.js:447-470`, terminal statuses — `server.js:17-25`.
- **Effect:** клиент получает ложное ожидание продолжения работы, мастер — шум по закрытой/отменённой заявке.
- **Cause:** bot handlers работают только по факту существования row, а не по lifecycle.
- **Status:** confirmed.

### P2-A02-03: Неизвестные команды становятся сообщениями мастеру

- **Promise:** неизвестная команда должна давать помощь или безопасную подсказку.
- **Reality:** всё, что не начинается с `/start`, считается клиентским текстом. Для связанного user `/help`, `/status`, `/cancel` и опечатки пересылаются мастеру; `/starter` ошибочно попадает в start handler.
- **Evidence:** `server.js:310-320`, `server.js:386-396`, `server.js:433-470`.
- **Effect:** клиент не узнаёт доступные действия, а мастер получает технический шум и потенциально ошибочно интерпретирует команду как просьбу.
- **Cause:** routing основан на одном `startsWith`, полноценной таблицы команд/unknown fallback нет.
- **Status:** confirmed.

### P2-A02-04: Non-text сообщения и фото с caption исчезают без ответа

- **Promise:** чат явно сообщает, какой дополнительный контент он принимает и что произошло после отправки.
- **Reality:** webhook обрабатывает только `message.text`; photo, document, voice, sticker и caption не читаются, update завершается как `unknown` без ответа.
- **Evidence:** `server.js:310-325`; клиентская реплика не говорит «только текст» — `server.js:418-428`; документация упоминает text — `docs/black-carp-mvp.md:189-196`.
- **Effect:** в тату-сценарии клиент естественно прикрепляет новый референс и считает его отправленным, но мастер ничего не получает.
- **Cause:** unsupported-content state отсутствует, Telegram affordance не ограничена и не объяснена.
- **Status:** confirmed.

### P2-A02-05: Длинный комментарий молча обрезается до 2000 UTF-16 units

- **Promise:** «отправьте одним сообщением» передаёт весь введённый комментарий.
- **Reality:** `normalizeText()` без предупреждения делает `.slice(0, 2000)` до отправки и сохранения activity.
- **Evidence:** `server.js:433-467`, `server.js:975-977`.
- **Effect:** конец идеи, ограничений или контактного уточнения теряется; клиент получает обычное подтверждение успешной доставки.
- **Cause:** общий normalizer применён как silent truncation вместо валидируемого лимита с user feedback.
- **Status:** confirmed.

### P2-A02-06: Follow-up комментарий не даёт мастеру one-tap переход в нужную CRM-карточку

- **Promise:** бот — быстрый транспорт в конкретную заявку CRM.
- **Reality:** новая заявка имеет WebApp button, а дополнительный комментарий отправляется plain text без reply markup. В истории CRM виден только тип события, не текст.
- **Evidence:** `server.js:462-467`, `server.js:541-561`, `crm/app.js:16-22`, `crm/app.js:95-99`.
- **Effect:** при потоке заявок мастер вручную ищет public code; позднее невозможно прочитать содержимое комментария из обычного UI.
- **Cause:** follow-up notification сделан общим text relay, не request-aware transport object.
- **Status:** confirmed.

### P2-A02-07: Crash-window outbox создаёт дубли новых заявок

- **Promise:** retry восстанавливает доставку, не создавая две одинаковые рабочие карточки.
- **Reality:** outbox ставится в `sending` до Bot API call; после restart любая `sending` безусловно переводится в retry. Если Telegram принял сообщение, а процесс завершился до `sent`, карточка отправится повторно; Telegram `message_id` не сохраняется.
- **Evidence:** `server.js:1074-1075`, `server.js:1337-1353`.
- **Effect:** мастер видит две «Новые заявки», может открыть/обработать обе как разные события и теряет доверие к очереди.
- **Cause:** at-least-once delivery не имеет UI-дедупликации или сохранённого transport receipt.
- **Status:** confirmed design behavior; occurrence requires a crash in the delivery window.

### P2-A02-08: Readiness может быть зелёной с неверным клиентским bot username

- **Promise:** возвращаемый `telegramUrl` ведёт в фактически настроенного бота.
- **Reality:** при пропущенном `BOT_USERNAME` используется `blackcarp_bot`, но readiness не считает переменную обязательной, хотя setup-документ считает.
- **Evidence:** `server.js:15`, `server.js:818-820`, `server.js:913-918`, `docs/telegram-bot-setup.md:24`.
- **Effect:** после возврата видимого Telegram CTA пользователь может попасть в неверного/несуществующего бота при формально healthy backend.
- **Cause:** runtime default скрывает критичную для deep link конфигурацию.
- **Status:** confirmed configuration gap; actual environment value was intentionally not inspected.

## P3

### P3-A02-01: Повторный `/start` засоряет activity и повторяет onboarding

- **Promise:** повторное открытие того же deep link безопасно и отражает уже связанную заявку.
- **Reality:** каждый новый update повторно добавляет `telegram_linked` и выдаёт первичное подтверждение; различия «уже связано» нет.
- **Evidence:** `server.js:407-430`; dedupe действует только на одинаковый `update_id` — `server.js:293-307`.
- **Effect:** timeline шумит, а клиент не понимает, произошла ли новая операция.
- **Cause:** бизнес-идемпотентность связи не отделена от transport idempotency.
- **Status:** confirmed.

### P3-A02-02: Ошибка/опечатка deep link предлагает только заполнить анкету заново

- **Promise:** ошибочный link даёт понятный recovery без потери уже созданной заявки.
- **Reality:** неизвестный, изменённый по регистру или устаревший code получает одинаковое «заполните заново», без номера, проверки ссылки, перехода в профиль или безопасного повторного ввода.
- **Evidence:** `server.js:386-404`.
- **Effect:** клиент может создать дубликат вместо восстановления нужного контекста.
- **Cause:** invalid-code state сведён к not-found без альтернативного recovery.
- **Status:** confirmed.

### P3-A02-03: Быстрая карточка мастера теряет часть уже собранного контекста

- **Promise:** мастер сразу видит суть проекта и контактный контекст.
- **Reality:** `contactComment`, `sketchComment` и `contactType` не передаются в payload карточки. При наличии `sizePreset` без `sizeCm` строка говорит «не выбран», хотя preset сохранён.
- **Evidence:** `server.js:667-710`, поля заявки — `server.js:1014-1022`; target card — `docs/crm-mvp-technical-spec.md:189-214`.
- **Effect:** мастер вынужден открыть CRM даже для решения, когда и как связаться; отдельный валидный backend payload может получить неточное описание размера.
- **Cause:** notification mapper содержит только сокращённое подмножество booking row и условно форматирует размер только по `sizeCm`.
- **Status:** confirmed.

### P3-A02-04: Текст мастера в bot chat обрабатывается как клиентский

- **Promise:** роли мастера и клиента имеют разные bot journeys.
- **Reality:** allowlist мастера проверяется только в callback/CRM auth. Обычный текст мастера попадает в клиентский handler: без client row он получает CTA анкеты, с row — сообщение рассылается в master chats.
- **Evidence:** `server.js:310-320`, `server.js:433-470`, role check only at `server.js:474-479`.
- **Effect:** ошибочный reply на уведомление даёт бессмысленный onboarding или эхо вместо подсказки открыть CRM.
- **Cause:** role dispatch отсутствует для message updates.
- **Status:** confirmed.
