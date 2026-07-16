# Decomposition

## A01: Публичный сайт, запись и профиль

- **Boundary:** главная, работы, запись, успех/ошибка/восстановление черновика, профиль последней заявки; без Telegram UI и CRM.
- **Likely files/routes:** `index.html`, `styles.css`, `script.js`, `/`, `/#/works`, `/#/booking`, `/#/profile`, `POST /api/booking/submit`, `GET /api/booking/status/:publicCode`.
- **Core questions:** понятность ценности и CTA; длина и логика анкеты; честность прогресса, цены и успеха; сохранение контекста; мобильная/десктопная пригодность; доступность.
- **Risk focus:** уход пользователя, скрытые обязательные действия, потеря черновика/файлов, ложный успех, навигация и фокус.
- **Assigned artifact folder:** `agents/A01-public-site-booking/`.

## A02: Telegram-бот

- **Boundary:** `/start`, привязка заявки, сообщения клиента, уведомления мастера, callback-действия и переход в CRM; без визуальной реализации сайта/CRM.
- **Likely files/routes:** `server.js`, `POST /telegram/webhook`, Bot API payload builders, `docs/telegram-bot-architecture.md`, integration tests.
- **Core questions:** что видят клиент и мастер; достаточно ли контекста и следующего шага; обработка неизвестных/повторных/ошибочных действий; соответствие роли «транспорт, не CRM».
- **Risk focus:** тупики, двусмысленные ответы, потеря доверия, незаметные ошибки, конфликт статусов между ботом и CRM.
- **Assigned artifact folder:** `agents/A02-telegram-bot/`.

## A03: CRM/WebApp мастера

- **Boundary:** вход, список, поиск/фильтры, карточка, контакт, статусы, заметки, планирование, вложения, история, ошибки; mobile и desktop.
- **Likely files/routes:** `crm/index.html`, `crm/styles.css`, `crm/app.js`, `/crm`, `/api/crm/*`, related `server.js` mappers/transitions.
- **Core questions:** скорость разбора входящих; ясность приоритетов; безопасность необратимых действий; сохранение/ошибки; мобильная навигация; доступность.
- **Risk focus:** незаметная новая заявка, неверный статус, потеря ввода, слабая обратная связь, неполная операционная картина.
- **Assigned artifact folder:** `agents/A03-crm-admin/`.

## A04: Сквозной UX, контракты и visual evidence

- **Boundary:** переходы сайт → API → бот → CRM → профиль; общая терминология, статусы, даты, ошибки, доступность, адаптивность и скриншоты текущего прогона.
- **Likely files/routes:** все поверхности выше, docs/specs/tests, локальные браузерные сценарии.
- **Core questions:** единая ли модель заявки; одинаковы ли обещания и факты; где пользователь теряет контроль; какие проблемы системные, а не локальные.
- **Risk focus:** разные источники истины, несогласованные статусы/копирайт, провалы между каналами, непроверенные состояния.
- **Assigned artifact folder:** `agents/A04-cross-area-ux/` (main agent).
