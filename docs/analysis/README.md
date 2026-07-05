# Carsale — Пакет системной аналитики

> Версия: 1.0 · Дата: 2026-06-28 · На основе: [PRD v1.1](../PRD.md)  
> Методология: ISO/IEC/IEEE 29148 · C4 + arc42 · UML (Cockburn Use Cases) · RTM

Полный инженерный пакет аналитики, подготовленный системным аналитиком на основе PRD v1.1.  
Охватывает Фазу 0 (MVP) полностью и Фазы 1–2 на уровне требований и архитектурных решений.

---

## Состав пакета

| # | Файл | Описание |
|---|------|----------|
| 00 | [00-analysis-plan.md](00-analysis-plan.md) | Точка входа: карта пакета, подход, дорожная карта, открытые вопросы верхнего уровня |
| 01 | [01-glossary-domain-model.md](01-glossary-domain-model.md) | Глоссарий единого языка (ubiquitous language) + концептуальная доменная модель + бизнес-правила (BR-1 – BR-14) |
| 02 | [02-stakeholders-actors.md](02-stakeholders-actors.md) | Стейкхолдеры, актёры системы, матрица ролей и доступа, RACI |
| 03 | [03-use-case-model.md](03-use-case-model.md) | Use case диаграмма (PlantUML) + реестр 17 UC + детальные спецификации по Cockburn для всех P0 UC |
| 04 | [04-functional-requirements.md](04-functional-requirements.md) | SRS (ISO 29148): FR-01 – FR-21, acceptance criteria в формате Gherkin/чеклист |
| 05 | [05-nonfunctional-requirements.md](05-nonfunctional-requirements.md) | NFR-1 – NFR-29: производительность, масштабируемость, надёжность, безопасность, ЗРУ-547, совместимость, наблюдаемость, локализация |
| 06 | [06-sequence-diagrams.md](06-sequence-diagrams.md) | 6 sequence-диаграмм Mermaid: регистрация, размещение (happy + fraud path), чат, оплата, каталог |
| 07 | [07-process-and-state.md](07-process-and-state.md) | Activity-диаграммы (3 бизнес-процесса) + State-диаграммы жизненного цикла Listing, User, Payment, Deal Rating |
| 08 | [08-data-model.md](08-data-model.md) | ER-диаграмма (Mermaid) + словарь всех сущностей с атрибутами, ограничениями, индексами |
| 09 | [09-architecture.md](09-architecture.md) | C4 Level 1–3 (Mermaid) + arc42: контекст, контейнеры, компоненты Core API, cross-cutting, deployment |
| 10 | [10-integrations-api.md](10-integrations-api.md) | Карта интеграций (11 систем) + контракты API (Eskiz, Click, ML Service, OneID, LLM) + sequence интеграций |
| 11 | [11-traceability-matrix.md](11-traceability-matrix.md) | RTM: G-1 – G-7 → FR/NFR → UC → диаграммы → acceptance criteria. Явные пробелы выделены |
| 12 | [12-risks-assumptions.md](12-risks-assumptions.md) | 14 рисков (уровень + митигация), 15 допущений, 8 открытых вопросов |
| 13 | [13-delivery-plan.md](13-delivery-plan.md) | WBS (11 эпиков), майлстоуны MVP, зависимости, T-shirt оценки, иллюстративный Гант |
| 14 | [14-adr/](14-adr/) | 6 ADR: SMS-шлюз, платёжный шлюз, ML seed-датасет, хостинг UZ, Web-first, модульный монолит |

---

## Быстрая навигация

**Для разработчиков:**
- [Архитектура и контейнеры → 09](09-architecture.md)
- [Модель данных → 08](08-data-model.md)
- [API контракты интеграций → 10](10-integrations-api.md)
- [Sequence-диаграммы → 06](06-sequence-diagrams.md)
- [ADR (технологические решения) → 14-adr/](14-adr/)

**Для QA:**
- [Acceptance criteria → 04 (FR)](04-functional-requirements.md)
- [NFR с метриками проверки → 05](05-nonfunctional-requirements.md)
- [RTM (что покрыто) → 11](11-traceability-matrix.md)

**Для PM:**
- [Use cases → 03](03-use-case-model.md)
- [Риски и допущения → 12](12-risks-assumptions.md)
- [План поставки → 13](13-delivery-plan.md)

**Для Legal / Compliance:**
- [ЗРУ-547 требования → 05 §5](05-nonfunctional-requirements.md)
- [ADR-004 хостинг в UZ → 14-adr](14-adr/ADR-004-uz-hosting.md)

---

## Открытые вопросы (требуют ответа до MVP)

| OQ | Вопрос | Блокирует |
|----|--------|-----------|
| OQ-1 | Юр. форма и регистрация ООО в UZ | Eskiz, Click, NFR-19 |
| OQ-2 | Click или Click + Payme? | FR-14 |
| OQ-3 | ML-команда: инхаус или подрядчик? | план поставки |
| OQ-5 | Хостинг-провайдер UZ | 09-architecture |

Полный список: [12-risks-assumptions.md §3](12-risks-assumptions.md)
