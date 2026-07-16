# A02 — Telegram-бот: WIP review и verification notes

Проверка выполнена 2026-07-12. Baseline — commit `4fe2382`; WIP — текущие uncommitted `server.js`, `test/crm.integration.test.js`, `crm/app.js`, `index.html`, `script.js` и Telegram/deploy docs. Product code этим агентом не менялся, реальные Telegram-запросы не выполнялись.

## Baseline vs remaining

| Severity | Baseline | Fixed by WIP | Remaining |
|---|---:|---:|---:|
| P1 | 6 | 1 | 5 |
| P2 | 8 | 0 | 8 |
| P3 | 4 | 0 | 4 |
| **Total** | **18** | **1** | **17** |

Status breakdown: 1 `fixed-by-WIP`, 3 `partially-addressed`, 13 `still-open`, 1 `needs-runtime/live-Telegram`. `fixed-by-WIP` означает только текущий локальный diff; до commit/deploy это не production status.

## Finding status matrix

| Finding | Current status | WIP evidence | Остаток |
|---|---|---|---|
| `P1-A02-01` client deep link скрыт | **still-open** | API всё ещё возвращает URL (`server.js:170-176`), сайт только кладёт его в storage (`script.js:1238-1243`), success UI имеет лишь restart (`index.html:435-440`) | Показать честный optional request-specific CTA; убрать loop общего bot link |
| `P1-A02-02` ложное обещание retry комментария | **fixed-by-WIP** | comment activity + outbox создаются вместе (`server.js:495-504`), worker доставляет `client_message` (`server.js:1408-1534`), failure copy обещает реальный retry (`server.js:505-506`); regression `test/crm.integration.test.js:133-167` | Не перепланировать; сохранить regression при дальнейших изменениях |
| `P1-A02-03` неверный request при нескольких заявках | **still-open** | routing всё ещё `ORDER BY COALESCE(telegram_opened_at, created_at)` (`server.js:480-486`), повторный start не обновляет first-open (`server.js:438-442`) | Явный active request/selection |
| `P1-A02-04` rebind/identity | **partially-addressed** | чужой user больше не перезаписывает существующий owner (`server.js:426-448`), есть test (`test/crm.integration.test.js:120-131`) | Первый claimant всё ещё доказывает владение публичным display code; нет audited transfer/recovery; нужен отдельный link token |
| `P1-A02-05` WebApp и group chat | **needs-runtime/live-Telegram** | notifier всё ещё всегда добавляет `web_app` (`server.js:577-588`), recipients остаются generic `MASTER_CHAT_IDS` (`server.js:933-938`); setup называет их просто «чаты» (`docs/telegram-bot-setup.md:24-28`) | Установить тип реальных chats; закрепить private-only contract или отдельный group transport |
| `P1-A02-06` legacy callback semantics | **still-open** | callback по-прежнему меняет status, включая `close -> cancelled` (`server.js:510-548`); текущий test всё ещё выполняет mutation (`test/crm.integration.test.js:90-95`) | Сделать legacy callbacks non-mutating и направлять в CRM |
| `P2-A02-01` потеря service acknowledgement | **still-open** | результаты start/comment replies игнорируются (`server.js:451-463`, `server.js:505-507`), `answerCallbackQuery` errors поглощаются (`server.js:607-613`) | Durable response для state-changing start/comment, наблюдаемый callback failure |
| `P2-A02-02` terminal lifecycle не учитывается | **still-open** | start читает row, но не branch по status (`server.js:418-461`); comment query не выбирает status (`server.js:480-506`) | Status-specific copy/rules |
| `P2-A02-03` unknown commands пересылаются | **still-open** | dispatch всё ещё `startsWith('/start')`, любой другой text идёт в comment handler (`server.js:319-329`) | Exact command parser и safe fallback |
| `P2-A02-04` media/caption silently ignored | **still-open** | dispatch обрабатывает только `message.text` (`server.js:319-334`) | Explicit text-only rejection либо отдельный media scope |
| `P2-A02-05` text silently truncated | **still-open** | comment проходит через общий `.slice(0, 2000)` (`server.js:466-468`, `server.js:1023-1025`) | Validated limit без truncation |
| `P2-A02-06` follow-up без CRM context/history payload | **partially-addressed** | delivery теперь durable, но outbox send остаётся без reply markup (`server.js:1505-1513`), CRM timeline всё ещё выводит только label (`crm/app.js:142`) | Exact CRM button + видимый text/delivery state в timeline |
| `P2-A02-07` crash-window duplicates | **partially-addressed** | claim token/lease и stale recovery добавлены (`server.js:1172-1179`, `server.js:1456-1497`), concurrency/stale test есть (`test/crm.integration.test.js:148-166`) | `sendMessage` success до DB `sent` остаётся неопределённым и после lease будет отправлен повторно; принять duplicate-tolerant contract и test |
| `P2-A02-08` readiness не проверяет bot username | **still-open** | runtime default сохранён (`server.js:15`), required list не содержит `BOT_USERNAME`/`CRM_WEBAPP_URL` (`server.js:940-946`), хотя docs называют обязательными (`docs/telegram-bot-setup.md:24`) | Fail-closed config validation + `getMe` staging check |
| `P3-A02-01` repeat start создаёт duplicate activity | **still-open** | same owner проходит обычный upsert и `telegram_linked` (`server.js:426-444`) | Business idempotency и distinct already-linked copy |
| `P3-A02-02` invalid-code recovery | **still-open** | invalid code всё ещё ведёт только к новой анкете (`server.js:405-423`) | Recovery через профиль/проверку/expired-token copy |
| `P3-A02-03` card теряет context | **still-open** | mapper/card всё ещё исключают contact/sketch comments/type (`server.js:694-737`, `server.js:1500-1503`) | Полный compact payload и truth table размера |
| `P3-A02-04` master text считается client text | **still-open** | role-aware branch есть только в callback; обычный text идёт в `handleClientMessage` (`server.js:319-329`, `server.js:466-507`) | Master text fallback на CRM, без client activity/outbox |

## Что WIP реально улучшил

1. `P1-A02-02`: клиентский comment теперь durable, имеет payload, retry, claim и delivery state.
2. `P1-A02-04`: существующая связь больше не перезаписывается чужим Telegram user.
3. `P2-A02-07`: конкурентный manual retry и раннее reclaim уменьшены claim token/lease.
4. Webhook secret теперь проверяется до JSON parse, malformed/oversize payload получают контролируемые ответы (`server.js:296-301`, `server.js:958-966`, `test/crm.integration.test.js:234-257`). Это hardening сверх A02 UX findings.
5. CRM master allowlist больше не fallback-ится на notification chats (`server.js:1211-1237`, `test/crm.integration.test.js:200-217`).

## Запущенные проверки

- `npm run check` — pass.
- `npm test` — pass, 12/12.
- Telegram transport в тестах — локальный HTTP stub (`test/crm.integration.test.js:33-54`); реальные сообщения не отправлялись.

Новые релевантные tests:

- foreign rebind rejection — `test/crm.integration.test.js:120-131`;
- durable client comment, concurrent retry, stale claim — `test/crm.integration.test.js:133-167`;
- pre-parse webhook secret/malformed JSON — `test/crm.integration.test.js:234-257`;
- explicit CRM allowlist — `test/crm.integration.test.js:200-217`.

## Непокрытые локальные сценарии

- success screen Telegram CTA и generic footer loop;
- same-user repeated start и exact response payload;
- expired/invalid/terminal start;
- две заявки и повторный выбор старой;
- exact commands/unknown/master text;
- photo/caption/document/voice;
- 2001+ characters;
- independent failure client service response и `answerCallbackQuery`;
- legacy close/spam no-mutation — текущий test, наоборот, закрепляет mutation;
- comment WebApp reply markup и CRM-visible payload;
- missing/mismatched `BOT_USERNAME`, invalid `CRM_WEBAPP_URL`;
- permanent recipient error/private-vs-group;
- crash injection строго после Telegram success и до outbox `sent`.

## Runtime/live gates

До production нельзя закрыть `P1-A02-05` и весь Telegram UX без:

- `getMe`: token соответствует ожидаемому username;
- `getChat`: каждый actionable recipient имеет `type=private`;
- пользователь-мастер начал чат с ботом;
- WebApp button открывает exact request и передаёт валидный initData на Telegram iOS/Android/Desktop;
- BotFather domain и `CRM_WEBAPP_URL` совпадают;
- `getWebhookInfo` показывает ожидаемые URL/secret-backed delivery, без backlog errors;
- staging retry/blocked-user сценарий показывает честный feedback;
- старые callback-кнопки в реальной Telegram history больше не меняют status.

## Review conclusion

WIP существенно исправляет сохранность комментариев и снижает риск rebind/concurrent retry, но это не полный bot UX pass. Из 18 baseline findings полностью закрыт один; 17 требуют кода, contract decision или live evidence. Главный порядок: обезвредить legacy callbacks, разделить public code и identity token, сделать routing request-scoped, затем закрыть payload/private-chat/delivery/test gaps.
