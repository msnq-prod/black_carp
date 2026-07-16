# Orchestration

## Wave 1

| Area | Agent | Model | Status | Artifact folder |
|---|---|---|---|---|
| A01 Public site/booking | `/root/a01_public_site` | available reasoning model | complete | `agents/A01-public-site-booking/` |
| A02 Telegram bot | `/root/a02_telegram_bot` | available reasoning model | complete | `agents/A02-telegram-bot/` |
| A03 CRM/admin | `/root/a03_crm_admin` | available reasoning model | complete | `agents/A03-crm-admin/` |
| A04 Cross-area/evidence | main agent | current model | complete | `agents/A04-cross-area-ux/` |

## Prompt template

Провести только аудит назначенной области. Не менять продуктовый код. Изучить текущее состояние после последнего commit и предыдущие аудиты только как карту риска. Записать в своей папке `01_ANALYSIS.md`, `02_PROBLEMS.md`, `03_NEEDS_MORE_RESEARCH.md`; после review-gate дополнить `04_SOLUTION_PLAN.md`, `05_VERIFICATION_NOTES.md`. Каждая проблема должна иметь promise/reality/evidence/effect/cause/status, severity P0–P3 и точные file:line. Проверить happy path, ошибки, reload/retry/back, stale/race, mobile/desktop, keyboard/a11y и UX truth в пределах области. Скриншоты делает main agent; можно перечислить состояния, которые нужно снять.

## Fallbacks

- Выбор модели агентом не экспонируется; используется доступная reasoning-модель.
- Живой Telegram UI недоступен без production-аккаунта; Bot API payloads и webhook тестируются локально, пробел фиксируется.
- Во время Wave 1 появился параллельный незакоммиченный WIP. Findings зафиксированы на baseline `4fe2382`; Iteration 2 обязана отметить, что уже закрыто текущим diff, и планировать только остаток.
