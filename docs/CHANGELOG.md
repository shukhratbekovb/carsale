# Changelog

## 2026-07-05

### Resolved
- FE-OQ-1 (WCAG-таргет для frontend) — закрыт: **WCAG 2.1 AA**; владелец (a11y-чемпион) назначается до старта Epic FE-1
- OQ-2 (платёжный шлюз для UI оплаты) — закрыт: **Click + Payme с первого дня** (экран выбора, оба redirect/webhook-flow); FE-6 скорректирован

### Added
- `frontend-plan.md` — план разработки Frontend, составлен навыком `senior-frontend` на основе PRD v1.1 и пакета аналитики
  - Профиль стека (`next-app-router`, подтверждён `frontend_decision_engine.py`), Next.js 14+ App Router / RSC-first
  - 4 обязательных допущения (устройство/сеть, LCP-таргет, SEO vs auth-walled, WCAG) — WCAG-таргет отмечен как открытый вопрос (FE-OQ-1)
  - Карта маршрутов с рендерингом по SSR/RSC/CSR, компонентная архитектура и design tokens, i18n (UZ/RU), стратегия производительности
  - WBS: 10 frontend-эпиков (FE-1 – FE-10), согласованных с backend-эпиками `analysis/13-delivery-plan.md`
  - Frontend-специфичные риски и открытые вопросы (FE-OQ-1, FE-R-1 – FE-R-5)
- `web/` — скаффолдинг Next.js 14 App Router проекта (`frontend_scaffolder.py`): TS strict, Tailwind, React Hook Form + Zod, Vitest + RTL
  - Проверено вживую: typecheck, lint, unit-тесты (smoke-тест на `Button`), production build (87.2 KB shared JS), dev-сервер (`/`, `/api/health` → 200)
  - Закрыты пробелы шаблона скаффолдера: заглушки `// TODO: Implement` в `vitest.config.ts`, `src/test/setup.ts`, `src/test/utils.tsx`, `lib/form-utils.ts`, `components/forms/form-field.tsx`; неверное размещение тестовых пакетов в `dependencies`; отсутствующие `jsdom`, `@vitejs/plugin-react`, `eslint-config-prettier`, `lucide-react`
  - Детали — `frontend-plan.md` §14

## 2026-06-28

### Added
- `analysis/` — полный пакет системной аналитики (15 документов + 6 ADR) на основе PRD v1.1
  - `00-analysis-plan.md` — план анализа, состав пакета, открытые вопросы
  - `01-glossary-domain-model.md` — глоссарий (28 терминов), доменная модель, бизнес-правила (BR-1 – BR-14)
  - `02-stakeholders-actors.md` — 10 стейкхолдеров, 16 актёров, матрица доступа, RACI
  - `03-use-case-model.md` — use case диаграмма, 17 UC, детальные спецификации P0
  - `04-functional-requirements.md` — SRS: FR-01 – FR-21, acceptance criteria
  - `05-nonfunctional-requirements.md` — NFR-1 – NFR-29 с метриками и методами проверки
  - `06-sequence-diagrams.md` — 6 sequence-диаграмм (happy path + error paths)
  - `07-process-and-state.md` — 3 activity-диаграммы + 4 state machine диаграммы
  - `08-data-model.md` — ER-диаграмма + словарь 10 сущностей
  - `09-architecture.md` — C4 Level 1–3 + arc42 (контекст, контейнеры, компоненты, деплой)
  - `10-integrations-api.md` — 11 интеграций, API-контракты (Eskiz, Click, ML, OneID, LLM)
  - `11-traceability-matrix.md` — RTM: G-1–G-7 → FR/NFR → UC → тесты
  - `12-risks-assumptions.md` — 14 рисков, 15 допущений, 8 открытых вопросов
  - `13-delivery-plan.md` — WBS (11 эпиков), майлстоуны, Гант (иллюстративный)
  - `14-adr/ADR-001` — Eskiz UZ как SMS-шлюз
  - `14-adr/ADR-002` — Click + Payme как платёжные шлюзы
  - `14-adr/ADR-003` — Стратегия ML seed-датасета (синтетическая генерация)
  - `14-adr/ADR-004` — Хостинг только в юрисдикции UZ (ЗРУ-547)
  - `14-adr/ADR-005` — Web-first архитектура (нет мобильного приложения в MVP)
  - `14-adr/ADR-006` — Модульный монолит как стартовая архитектура
- `README.md` — индекс документации
- `CHANGELOG.md` — этот файл
