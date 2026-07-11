# Orchestration

## Wave 1 — Evidence discovery

| Area | Subagent | Model | Status | Artifact folder |
|---|---|---|---|---|
| A01 | two attempts, main fallback | platform reasoning model | complete | `agents/A01-client-booking-ux/` |
| A02 | two attempts, main fallback | platform reasoning model | complete | `agents/A02-crm-backend-webapp/` |
| A03 | two attempts, main fallback | platform reasoning model | complete | `agents/A03-bot-ops-security/` |

## Wave 2 — Solution planning

Те же субагенты возвращаются к своим областям после main-agent review gate и пишут `04_SOLUTION_PLAN.md` и `05_VERIFICATION_NOTES.md`.

## Prompt template

Проведи audit-only анализ назначенной области проекта Black Carp. Не изменяй продуктовый код и файлы вне назначенной папки. Прочитай `00_SCOPE.md` и `01_DECOMPOSITION.md`, затем исследуй только свою область. Создай в назначенной папке `01_ANALYSIS.md`, `02_PROBLEMS.md`, `03_NEEDS_MORE_RESEARCH.md`. Для каждого finding укажи severity, promise/reality, точные `file:line`, эффект, причину и статус confirmed/hypothesis/needs verification. Проверь отрицательные пути, source of truth, contracts и прежние выводы. Не предлагай исправления до второй итерации.

## Fallbacks

- Выбор конкретной модели в multi-agent API недоступен; используется reasoning-модель платформы.
- Максимум три активных субагента из-за доступного лимита параллелизма.
- Две параллельные тройки субагентов были реально запущены. Первая завершилась общей ошибкой refresh-token, вторая — transport disconnect до записи файлов.
- По правилу skill все три области затем выполнены main agent последовательно в тех же назначенных папках. Ошибки субагентов относятся к orchestration infrastructure, не к проекту.
