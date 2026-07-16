# A02 — Telegram-бот: UX-анализ, Iteration 1

Дата проверки: 2026-07-12. Baseline: последний commit `4fe2382` (`Build production CRM and Telegram workflow`). Все `file:line` относятся к этому baseline, прочитанному до начала параллельных uncommitted изменений. Обнаруженные позднее чужие изменения `server.js`/`crm/app.js` в выводы Iteration 1 не включались и не редактировались этим агентом.

## Граница

Проверены только Telegram-контуры:

- webhook, `/start`, клиентские текстовые сообщения и callback-действия в `server.js`;
- карточка новой заявки мастеру, outbox и deep link в CRM;
- клиентский deep link с сайта как вход в `/start`;
- различия ролей клиента и мастера;
- тексты, повторы, неизвестные команды, неподдержанные payload и ошибки доставки;
- соответствие `docs/telegram-bot-architecture.md`, `docs/telegram-bot-setup.md`, `docs/black-carp-mvp.md`, `docs/crm-mvp-technical-spec.md` и `test/crm.integration.test.js`.

Визуальный UI сайта и CRM не переоценивался, кроме мест, непосредственно создающих или принимающих Telegram deep link. Реальный Telegram и production-бот не использовались.

## Заявленная модель

- Клиент отправляет заявку на сайте; Telegram для него необязателен (`docs/telegram-bot-architecture.md:5-10`).
- `/start <code>` дополнительно связывает Telegram-профиль клиента с конкретной заявкой (`docs/telegram-bot-architecture.md:10`).
- Бот сразу присылает мастеру уведомление и открывает защищённую CRM WebApp (`docs/telegram-bot-architecture.md:8-9`).
- Бот — транспорт, а не второй CRM-интерфейс (`docs/crm-mvp-technical-spec.md:50-59`).
- Дополнительные текстовые комментарии клиента пересылаются мастеру (`docs/black-carp-mvp.md:189-198`).
- Outbox заявлен как контур гарантированной доставки уведомлений (`docs/telegram-bot-architecture.md:18-19`).

## Фактический поток

1. `POST /api/booking/submit` атомарно сохраняет заявку и создаёт по одной outbox-записи на каждый `MASTER_CHAT_IDS` (`server.js:96-155`, `server.js:1318-1322`).
2. До ответа сайту сервер пытается доставить все новые outbox-записи (`server.js:162-170`, `server.js:1324-1329`).
3. Мастер получает plain-text карточку и одну inline WebApp-кнопку на `/crm?request=<publicCode>` (`server.js:541-552`, `server.js:667-695`). CRM читает параметр `request` и открывает заявку после загрузки списка (`crm/app.js:3-5`, `crm/app.js:231-239`).
4. Backend также возвращает клиентский `https://t.me/<bot>?start=<publicCode>` (`server.js:164-170`, `server.js:818-820`). Сайт сохраняет URL только в `localStorage`, но не показывает его (`script.js:1182-1187`); экран успеха содержит только повторную заявку (`index.html:435-440`).
5. `/start <code>` записывает/обновляет Telegram-клиента, безусловно перепривязывает `booking_requests.client_id`, фиксирует первое открытие и отвечает сервисным сообщением (`server.js:386-430`).
6. Любой следующий текст связанного Telegram user направляется в одну неявно выбранную заявку и best-effort рассылается во все master chats (`server.js:433-471`, `server.js:555-561`). Для этих сообщений outbox отсутствует.
7. Legacy callback handler продолжает менять статусы, хотя текущая карточка заявки callback-кнопок уже не содержит (`server.js:474-511`, `server.js:546-552`).

## Что видит клиент

| Сценарий | Фактический ответ | Состояние |
|---|---|---|
| `/start` без payload | «Сначала заполните анкету» + кнопка на `/#/booking` (`server.js:386-396`) | Работает, но не узнаёт уже отправленную с этого устройства заявку |
| `/start <неизвестный код>` | «Заявка не найдена… заполните заново» (`server.js:399-404`) | Нет проверки опечатки, повторного открытия или пути к статусу |
| `/start <валидный код>` | «Ваша заявка получена… мастер скоро свяжется» (`server.js:418-428`) | Не показывает номер и текущий статус заявки |
| Повторный `/start` | Та же успешная реплика, ещё одно событие `telegram_linked` (`server.js:407-430`) | Бизнес-событие не идемпотентно между разными Telegram updates |
| `/start` завершённой/отменённой заявки | Та же реплика «скоро свяжется» | Lifecycle заявки не проверяется |
| Текст до привязки | Предложение создать заявку на сайте (`server.js:437-444`) | Понятный recovery path |
| Текст после привязки | «Комментарий передан» либо «сохранён, мастер увидит после восстановления» (`server.js:462-470`) | Второй текст правдив только частично: retry нет, CRM UI содержимое не показывает |
| `/help`, `/status` после привязки | Уходят мастеру как комментарий | Командного роутера нет |
| Фото/документ/voice/фото с caption | Нет ответа | Webhook помечает update как `unknown` (`server.js:310-325`) |

## Что видит мастер

### Новая заявка

Карточка содержит:

- номер, технически описанный статус;
- имя и контакт;
- опыт, предыдущий визит, наличие эскиза;
- зону, сторону, размер, оценку, идею и число вложений;
- кнопку `Открыть заявку` в CRM.

Payload строится в `server.js:667-710`, кнопка — в `server.js:541-552`.

Не попадают в быструю карточку:

- `contactComment` — например, удобное время связи;
- `sketchComment`;
- явный `contactType`;
- факт последующей Telegram-привязки клиента.

Эти поля есть в заявке/CRM, но отсутствуют в `bookingPayloadFromRow()` (`server.js:698-710`) и `masterCardText()` (`server.js:667-695`).

### Дополнительный комментарий

Мастер получает отдельное plain-text сообщение с кодом заявки и Telegram-идентичностью клиента (`server.js:462-467`). Кнопки открытия именно этой заявки нет. В CRM activity сохраняется payload с текстом (`server.js:469`), однако timeline выводит только label `Сообщение клиента`, без payload (`crm/app.js:16-22`, `crm/app.js:95-99`).

### Callback

Текущий мастерский notification payload callback-кнопок не создаёт (`server.js:546-552`). При этом webhook принимает actions `review`, `details`, `offer`, `close`, меняет статус и отвечает внутренним enum (`server.js:474-511`). Тест также считает этот маршрут живым (`test/crm.integration.test.js:81-82`).

До CRM-релиза бот отправлял кнопки `Взять в работу`, `Уточнить`, `Предложить консультацию`, `Закрыть`, `Спам`; историческая кнопка `close` означала `closed`, а сейчас означает `cancelled` (`d1fa82c:server.js:326-404`; текущее соответствие — `server.js:481-487`). Старые сообщения Telegram не исчезают после обновления backend.

## Повторы и состояние

- Числовой `update_id` резервируется до side effects; завершённый update возвращается как duplicate (`server.js:293-307`). Это исправляет прежнюю основную race-проблему.
- Один и тот же `update_id` не повторяет действие. Новый Telegram update с тем же `/start` повторяет `telegram_linked` и клиентское подтверждение.
- `telegram_opened_at` задаётся только один раз через `COALESCE` (`server.js:410-414`). Поэтому повторное открытие deep link старой заявки не делает её активной для последующего комментария.
- Комментарий выбирает заявку по максимальному `COALESCE(telegram_opened_at, created_at)` без явного контекста (`server.js:447-453`). При нескольких заявках выбор скрыт от клиента.
- Outbox имеет claim `sending`, retry с экспоненциальной задержкой и периодический worker (`server.js:1331-1364`). После старта процесса все оставшиеся `sending` переводятся в retry (`server.js:1074-1075`), что даёт at-least-once, а не exactly-once доставку.

## Ошибки доставки

| Операция | Ошибка Bot API | Что сохраняется | Что узнаёт пользователь |
|---|---|---|---|
| Новая заявка мастеру | Outbox становится `retry_wait` (`server.js:1355-1363`) | Заявка и ошибка сохранены | Сайт видит `masterNotified:false` |
| `/start` — ответ клиенту | `sendTelegramMessage()` возвращает `{ok:false}` (`server.js:564-577`) | Привязка уже сохранена; update считается завершённым | Клиент не получает ничего; retry ответа нет |
| Комментарий мастеру | Activity получает `delivered:false` (`server.js:462-470`) | Текст лежит только в activity payload | Клиенту обещают будущую доставку, которой нет |
| Подтверждение комментария клиенту | Результат `sendTelegramMessage()` игнорируется (`server.js:470`) | Update считается завершённым | Клиент может не увидеть даже состояние доставки |
| Callback answer | Ошибка только логируется и поглощается (`server.js:580-586`) | Смена статуса уже применена | В Telegram остаётся spinner/нет подтверждения |

## Роли

- Callback разрешён только `MASTER_TELEGRAM_IDS` (`server.js:474-479`, `server.js:1127-1132`) — разделение user ID и chat ID реализовано.
- `/start` и обычный text role-aware не являются. Разрешённый мастер может связать себя как клиента; любой владелец public code может заменить текущий `client_id` (`server.js:399-415`).
- Текст мастера, отправленный боту, обрабатывается как клиентский: либо отправляется обратно в master chats, либо мастер получает CTA анкеты (`server.js:433-470`).
- `MASTER_CHAT_IDS` допускает несколько произвольных Telegram chats (`server.js:906-910`), но карточка всегда использует `web_app`. Telegram документирует inline `web_app` как доступный только в private chat между пользователем и ботом; тип chat конфигурацией не проверяется.

## Deep links

### Клиент

- Builder корректно создаёт короткий допустимый payload `BC......` (`server.js:658-665`, `server.js:818-820`).
- Основной UI этот URL не показывает: значение остаётся в `localStorage` (`script.js:1182-1187`), а `openTelegramLink()`/`fallbackTelegramUrl()` не вызываются (`script.js:1156-1161`, `script.js:1258-1284`).
- Единственная видимая ссылка Telegram в шапке — общая, без `start` (`index.html:103-106`); она приводит в ветку «сначала заполните анкету».

### Мастер

- URL строится как `${CRM_WEBAPP_URL}?request=<publicCode>` (`server.js:546-549`).
- CRM читает код и вызывает detail endpoint, принимающий и request id, и public code (`crm/app.js:3-5`, `crm/app.js:231-239`, `server.js:1180-1182`).
- Интеграционный тест проверяет окончание URL и проходит (`test/crm.integration.test.js:66-68`).
- `BOT_USERNAME` документацией назван обязательным (`docs/telegram-bot-setup.md:24`), но readiness его не проверяет (`server.js:913-918`); fallback `blackcarp_bot` может породить формально зелёную, но неверную клиентскую ссылку (`server.js:15`, `server.js:818-820`).

## Соответствие документации и тестам

### Подтверждено

- Сохранение заявки не зависит от Telegram: `npm test` проверяет `retry_wait` при полном отказе (`test/crm.integration.test.js:142-155`).
- Master WebApp deep link содержит public code (`test/crm.integration.test.js:66-68`).
- Webhook secret и базовая дедупликация проверены (`test/crm.integration.test.js:157-176`).
- Happy path `/start` создаёт связь клиента (`test/crm.integration.test.js:76-80`).
- Текущий прогон `npm test`: 7/7 pass, внешние Telegram-запросы не выполнялись.

### Не покрыто

- тексты и reply markup ответов `/start`;
- отсутствие deep link на клиентском success screen;
- повторный `/start`, другой Telegram user и terminal status;
- две и более заявки одного клиента и повторное открытие старого deep link;
- неизвестные команды, photo/document/voice/caption и text > 2000 символов;
- полный отказ именно при клиентском комментарии;
- потеря ответа клиенту и `answerCallbackQuery`;
- callback authorization/unknown/not-found/invalid transition/stale legacy buttons;
- private chat против group/supergroup для master notification;
- restart в окне `sending -> Telegram accepted -> sent`.

Тест `test/crm.integration.test.js:81-82` вручную вызывает callback, которого нет ни в одном текущем notification payload. Это закрепляет legacy route, но не проверяет его актуальную точку входа и семантику старых кнопок.

## Итог Iteration 1

P0 не подтверждены. Основные UX-риски: клиентский deep link фактически недоступен, failed comment получает ложное обещание будущей доставки, комментарии при нескольких заявках могут уйти не в ту заявку, public code можно перепривязать к другому Telegram user, а legacy callback-кнопка `Закрыть` после миграции меняет смысл на `cancelled`. Отдельный условный P1 — WebApp-кнопка несовместима с group chat, хотя конфигурация не запрещает такие `MASTER_CHAT_IDS`.
