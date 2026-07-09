# Carsale — инструкции для Claude Code

Веб-маркетплейс купли-продажи авто в Узбекистане (UZ-first, UZ+RU интерфейс). Дифференциатор — Deal Rating (AI-оценка цены), детекция скрученного пробега, антифрод, авто-блюр номеров. Полный контекст продукта: [docs/PRD.md](docs/PRD.md) и пакет аналитики [docs/analysis/](docs/analysis/) (00–14, включая ADR).

Для актуального состояния разработки и решений последних сессий — **сначала прочитать [docs/HANDOFF.md](docs/HANDOFF.md)**.

## Стек (web/)

- Next.js 14 App Router, React 18, TypeScript strict
- Tailwind CSS + design tokens (Deal Rating цветовая семантика)
- React Hook Form + Zod
- Vitest + React Testing Library
- Полное обоснование стека и WBS эпиков — [docs/frontend-plan.md](docs/frontend-plan.md)

Backend/ML/инфраструктура пока не заскаффолжены — только frontend (`web/`) в работе.

## Workflow-правила (обязательные)

**Git commit strategy** — коммитить после каждого содержательного шага (доки, скаффолдинг, фичи, фиксы), не батчить несвязанные изменения в один коммит.
- Conventional Commits: `type(scope): summary`, imperative mood. Используемые типы: `feat`, `fix`, `test`, `docs`, `chore`, `refactor`.
- Атомарные коммиты — один логический concern на коммит, не смешивать доки и код.
- Тело коммита объясняет *почему*, не только *что*; перечисляет, что проверено (typecheck/lint/test/build), если коммит трогает код.
- Каждый коммит заканчивается `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` (или соответствующей моделью).

**Next.js dev/build конфликт** — НЕ запускать `npm run build` в `web/`, пока в фоне уже работает `npm run dev`: оба процесса пишут в один `.next/` и корродируют кэш друг друга (симптом: `MODULE_NOT_FOUND` / 500 на существующих роутах).
- Верифицировать изменения через `typecheck` + `lint` + `test` + curl на уже запущенный dev-сервер.
- Полный `build` — только когда dev остановлен (например, перед финальным/релизным коммитом); после — перезапустить dev с чистым `.next/`, если оба нужны подряд.

## Специализированные субагенты (`.claude/agents/`)

Использовать проактивно по scope:
- `data-agent` — `web/types/**`, `web/lib/mock/**`, `web/lib/catalog/**` и другие `web/lib/**` хелперы (форма данных, фильтрация/сортировка)
- `ui-agent` — `web/components/**`, `web/app/**` (React/Next.js UI, вёрстка, Tailwind)
- `test-agent` — `web/**/*.test.ts(x)` (Vitest/RTL юнит- и компонентные тесты)

## MCP-серверы

Настроены в `.mcp.json` в корне репозитория (общие для команды): `playwright` (браузерная автоматизация/e2e), `context7` (актуальная документация библиотек), `github` (требует авторизации через `/mcp` при первом использовании — у каждого разработчика своя).
