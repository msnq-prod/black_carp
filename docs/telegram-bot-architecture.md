# Black Carp — Telegram-бот и заявка на своем сервере

## Цель

Клиент заполняет анкету на сайте. При клике `Перейти в Telegram` сайт отправляет заявку на backend. Backend сохраняет заявку и вложения, создает публичный код и возвращает deep link в бота.

Telegram ID клиента появляется только после `/start <code>`. Поэтому текущий backend уведомляет мастера после того, как клиент открыл Telegram и заявка связалась с Telegram-профилем.

## Стек

| Слой | Решение |
|---|---|
| Сайт | текущий HTML/CSS/JS |
| Backend | Node.js + Express |
| БД | SQLite-файл `data/black-carp.sqlite` |
| Файлы | локальная папка `uploads/booking/` |
| Telegram | Bot API webhook |
| Запуск | `npm start`, дальше pm2/systemd |

Для текущего объема этого достаточно. Если позже появятся CRM, несколько мастеров, календарь и платежи, SQLite можно заменить на PostgreSQL.

## Поток

```mermaid
sequenceDiagram
    participant C as Клиент
    participant S as Сайт
    participant API as Express backend
    participant DB as SQLite
    participant FS as uploads
    participant TG as Telegram Bot API
    participant M as Мастер

    C->>S: Заполняет анкету
    C->>S: Нажимает "Перейти в Telegram"
    S->>API: POST /api/booking/submit
    API->>FS: Сохраняет эскиз/референсы
    API->>DB: Создает заявку и publicCode
    API-->>S: telegramUrl
    S->>C: Открывает Telegram
    C->>TG: /start publicCode
    TG->>API: POST /telegram/webhook
    API->>DB: Связывает клиента с заявкой
    API->>TG: Подтверждение клиенту
    API->>TG: sendMessage мастеру
    TG->>M: Карточка заявки
```

## База данных

Сервер сам создает схему при старте.

Основные таблицы:

- `clients` — Telegram-профиль клиента;
- `booking_requests` — анкета и статус заявки;
- `booking_attachments` — ссылки на локальные файлы;
- `status_history` — история статусов;
- `telegram_updates` — защита от повторной обработки webhook.

Ключевые статусы:

| Статус | Значение |
|---|---|
| `submitted` | анкета сохранена |
| `awaiting_client_start` | заявка сохранена, клиент еще не нажал Start в Telegram |
| `client_linked` | клиент открыл бота и связан с заявкой |
| `in_review` | мастер взял заявку |
| `need_details` | нужны уточнения |
| `consultation_offered` | предложена консультация |
| `closed` | закрыто |
| `spam` | спам |

Отдельно в `status_history` пишется событие `master_notify_failed`, если Telegram API или настройки бота не позволили уведомить мастера после `/start`.

## API

### `POST /api/booking/submit`

Принимает анкету с сайта.

Делает:

1. Проверяет payload.
2. Сохраняет вложения в `uploads/booking/<requestId>/`.
3. Создает заявку в SQLite.
4. Ставит заявке статус `awaiting_client_start`.
5. Возвращает `telegramUrl`.

Повторная отправка с тем же `idempotencyKey` возвращает уже созданную заявку с `duplicate: true`.

### `POST /telegram/webhook`

Принимает события Telegram.

Обрабатывает:

- `/start <code>`;
- обычные текстовые сообщения клиента после привязки заявки;
- inline-кнопки мастера;
- повторные `update_id`.

### `GET /api/booking/status/:publicCode`

Возвращает безопасный статус заявки для сайта.

## Что видит клиент

На сайте:

- анкету;
- итоговое резюме;
- ориентировочную стоимость;
- согласие на отправку данных;
- кнопку `Перейти в Telegram`.

В Telegram после `/start <code>`:

```text
Ваша заявка получена.

Мастер скоро свяжется с вами для утверждения заявки.
Если хотите, отправьте сюда дополнительные комментарии одним сообщением.
```

## Что видит мастер

Мастер получает карточку:

```text
Новая заявка Black Carp #BC5LFZ58

Статус: клиент перешел в Telegram после анкеты

Опыт: первая татуировка
У мастера ранее: не применимо
Эскиз: нужна разработка
Зона: Спина / Лопатки / сзади
Размер: M, около 15 см
Оценка: 12 000 - 18 000 ₽

Идея:
...

Вложения: 1
```

Кнопки мастера:

- `Взять в работу`;
- `Уточнить`;
- `Предложить консультацию`;
- `Закрыть`;
- `Спам`.

## Требования

Функционально:

- сайт отправляет анкету на backend до открытия Telegram;
- backend сохраняет заявку;
- backend сохраняет вложения;
- backend возвращает deep link;
- `/start <code>` связывает Telegram-клиента с заявкой;
- backend уведомляет мастера после `/start <code>`;
- Telegram-сбой не должен ломать сохранение заявки;
- master callback меняет статус заявки.

Нефункционально:

- HTTPS на продакшене;
- `.env` не хранить в git;
- `data/` и `uploads/` бэкапить;
- лимитировать размер JSON и файлов;
- не логировать токены и персональные данные;
- запускать сервер через pm2/systemd.
