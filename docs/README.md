# Carsale — Документация

Репозиторий документации продукта Carsale.

## Структура

| Файл / Папка | Описание |
|-------------|----------|
| [PRD.md](PRD.md) | Product Requirements Document v1.1 — исходный документ требований |
| [analysis/](analysis/) | Полный пакет системной аналитики (15 документов + 6 ADR) — составлен по PRD |
| [frontend-plan.md](frontend-plan.md) | План разработки Frontend — стек (Next.js App Router), карта маршрутов, компоненты, WBS эпиков, риски — составлен на основе PRD и пакета аналитики навыком `senior-frontend` |
| [HANDOFF.md](HANDOFF.md) | Снапшот текущего состояния разработки — что сделано, что в работе, ключевые решения. Читать первым при подключении нового участника |

## Быстрый старт

1. Прочитать [PRD.md](PRD.md) — понять продукт и цели
2. Открыть [analysis/README.md](analysis/README.md) — навигация по пакету аналитики
3. Для разработки начать с [analysis/09-architecture.md](analysis/09-architecture.md) и [analysis/08-data-model.md](analysis/08-data-model.md)
4. Для frontend-разработки — [frontend-plan.md](frontend-plan.md)
5. Для актуального статуса и hand-off — [HANDOFF.md](HANDOFF.md), а также корневой [`CLAUDE.md`](../CLAUDE.md) с workflow-правилами
