# Handoff — состояние проекта на 2026-07-09

Снапшот для нового участника (человека или Claude Code сессии), продолжающего работу параллельно. Дополняет [CLAUDE.md](../CLAUDE.md) (правила workflow) и [frontend-plan.md](frontend-plan.md) (полный план, эпики FE-1–FE-10).

## Что уже сделано

Хронология (см. `git log --oneline` для точных коммитов):

1. **Документация продукта** — PRD v1.1 + полный пакет системной аналитики (`docs/analysis/`, 15 документов + 6 ADR)
2. **Frontend-план** — `docs/frontend-plan.md`, стек подтверждён `frontend_decision_engine.py` (next-app-router, fit 100%)
3. **Скаффолдинг `web/`** — Next.js 14 App Router, TS strict, Tailwind, RHF+Zod, Vitest+RTL. Пробелы шаблона `frontend_scaffolder.py` закрыты вручную (детали в frontend-plan.md §14)
4. **Сайт-шелл и главная** — layout в стиле auto.ru
5. **Deal Rating design tokens + mock-каталог объявлений**
6. **`/catalog`** — фильтры, сортировка, grid/list виды, URL-синхронизация (FR-06)
7. **Расширенная модель `Listing`** (condition/fuel/color) + централизованные UI-лейблы
8. **`/catalog/[id]`** — SSR карточка объявления (FR-07), тесты на `ListingCard`/`ListingRow`/detail page
9. **Субагенты** — `.claude/agents/{ui,data,test}-agent.md` для разделения frontend-работы по scope
10. **Auth / OTP (FE-2, в работе)**:
    - Data layer: `web/types/auth.ts`, `web/lib/validation/auth.ts` (Zod), `web/lib/mock/otp.ts` (мок-сервис отправки/проверки OTP), `web/lib/auth/otp-flow.ts` (reducer состояния флоу)
    - UI: `/auth/login` (ввод телефона) и `/auth/otp` (ввод кода) — `web/app/auth/{login,otp}/page.tsx`, `web/components/auth/{phone-form,otp-form}.tsx`
    - Тесты: покрыты flow-логика, Zod-схемы, обе формы (`*.test.ts(x)` рядом с исходниками)

## В работе / следующий шаг

Согласно frontend-plan.md §13 и §11 (Epic FE-2 → FE-3):

- **FE-2 (Auth UI) близок к завершению** — то, что ещё не сделано: таймер повторной отправки OTP на UI (если не реализован — проверить `otp-form.tsx`), блокировка после 3 неверных попыток на 15 мин (см. frontend-plan §9), JWT-сессия на клиенте (httpOnly refresh) — уточнить текущее покрытие перед тем, как считать эпик закрытым
- **Дальше по критическому пути**: FE-3 (wizard размещения объявления — самый тяжёлый эпик, XL, 5–6 недель) — `PhotoUploadWizard`, `PriceEstimateWidget` (4 состояния Deal Rating)
- **Не начато и блокирует другие эпики, если отложить**: i18n (next-intl, UZ/RU) — должно войти в инфраструктуру до первой "настоящей" страницы, не быть довеском в конце (FE-R-5, явный анти-паттерн-риск)
- **Не поднято**: CI-гейты (bundlewatch, lighthouse-ci, axe, playwright) — планировались с первого PR каркаса, пока отложены

## Ключевые решения, зафиксированные в ходе разговора (2026-07-05)

- WCAG 2.1 AA подтверждён как обязательный a11y-таргет (владелец/чемпион внутри команды — ещё не назначен, административная задача)
- Оба платёжных шлюза (Click + Payme) с первого дня, экран выбора + двойной redirect/webhook-flow (не один шлюз в MVP)
- ML-флаги (Deal Rating, пробег) обязаны приходить в том же SSR/RSC-запросе, что и данные объявления — no lazy-load после LCP, это прямое acceptance criteria FR-07/NFR-2, а не опциональная оптимизация

## Правила процесса (уже перенесены в CLAUDE.md, дублирую как самое важное)

1. Коммитить после каждого шага, Conventional Commits, атомарно — см. [CLAUDE.md](../CLAUDE.md#workflow-правила-обязательные)
2. Никогда не гонять `npm run build` в `web/`, пока фоном работает `npm run dev` — ломает общий `.next/` кэш (см. тот же раздел CLAUDE.md)

## Окружение

- Репозиторий инициализирован 2026-07-05, ветка `main`, коммитов чистая история (см. `git log`)
- `web/` — рабочая директория для всей frontend-разработки; `docs/` — вся продуктовая/системная документация, не трогать без явной причины
- MCP-серверы команды — `.mcp.json` в корне (`playwright`, `context7`, `github`); при первом открытии проекта Claude Code спросит разрешение на них, `github` дополнительно потребует `/mcp`-авторизацию per-user
