# Handoff — состояние проекта на 2026-07-14 (обновлено: favorites/my-listings, CI зелёный на GitHub)

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
11. **FE-2 подтверждён закрытым (2026-07-09)** — resend-таймер (60 сек) и блокировка после 3 неверных попыток (15 мин) уже были реализованы и покрыты тестами в `otp-flow.ts`/`otp-form.tsx`, проверено при старте FE-3. Единственное, что осталось вне фронтенда — JWT-сессия (httpOnly refresh), блокируется отсутствием Core API/бэкенда.
12. **FE-3 (wizard размещения объявления, FR-02/03/05) — начат 2026-07-09**:
    - Data layer: `web/types/sell.ts` (WizardStep, PhotoDraft — discriminated union по статусу блюра, PriceEstimateState — IDLE/LOADING/LOADED/FAILED поверх тех же 4 меток DealRating, что и у каталога, ListingDraft, WizardFlowState), `web/lib/validation/sell.ts` (Zod-схемы по шагам: vehicleDetailsSchema/reviewSchema/photosSchema), `web/lib/mock/photo-blur.ts` (мок CV-детекции блюра), `web/lib/mock/price-estimate.ts` (мок ML-оценки цены, детерминированный по входу), `web/lib/sell/wizard-flow.ts` (pure reducer навигации/мутации черновика, стиль как у `otp-flow.ts`)
    - UI: `/sell/new` (`web/app/sell/new/page.tsx`) → `SellWizard` (`web/components/sell/sell-wizard.tsx`, useReducer-обёртка над wizard-flow.ts) со степ-индикатором и 4 шагами: `VehicleDetailsStep`, `PhotoUploadStep` (превью + overlay обнаруженных областей блюра + ручная корректировка X/Y/W/H в %), `PriceEstimateWidget` (авто-запрос оценки при входе на шаг, 4 состояния Deal Rating через переиспользуемый `DealRatingBadge`), `ReviewStep` (сводка + публикация → экран «на модерации»)
    - Новый переиспользуемый `web/components/forms/select-field.tsx` (RHF+Controller обёртка над `<select>`, аналог `form-field.tsx`)
    - Проверено вживую через Playwright MCP на реальном dev-сервере: полный happy path от характеристик до подтверждения «на модерации», включая загрузку фото и оценку цены
    - Тесты: `wizard-flow.test.ts`, `validation/sell.test.ts`, `mock/{photo-blur,price-estimate}.test.ts` (от data-agent) + `vehicle-details-step.test.tsx`, `photo-upload-step.test.tsx`, `price-estimate-widget.test.tsx`, `review-step.test.tsx`, `sell-wizard.test.tsx` (интеграционный happy-path) — итого 132/132 теста проходят
    - **Найдено и исправлено при живой проверке**: (1) `z.coerce.number()` в схеме ломал типизацию `Control<T>` между `zodResolver` и `useForm` — исправлено явным `as Resolver<VehicleDetailsInput>` с комментарием-объяснением; (2) `FormField` не имел `value={field.value ?? ''}` fallback — числовые поля стартовали `undefined` (uncontrolled) и становились controlled при вводе, React ругался — пофикшено на уровне `form-field.tsx` (затрагивает все формы); (3) `vehicle-details-step.tsx` дефолтил опциональное поле `color` в `''` вместо `undefined` — пустая строка не проходит `.optional()` в Zod (только `undefined` проходит), из-за чего форма не сабмитилась с «Invalid input» на пустом необязательном поле
    - **Что осталось внутри FE-3**: тесты на сам `select-field.tsx` (сейчас покрыт только косвенно через степ-компоненты), реальная интеграция с Core API вместо моков (блокер — бэкенда ещё нет), возможно вынести `SellWizard`'ную кнопку «Назад» в общий компонент степ-навигации, если появятся другие wizard'ы
13. **i18n (next-intl, UZ/RU) — внедрён полностью 2026-07-11** (закрыт риск FE-R-5, NFR-28/29):
    - Инфраструктура: `web/i18n/{routing,navigation,request}.ts`, `web/middleware.ts`, плагин в `next.config.js`. UZ — локаль по умолчанию **без префикса** (`/catalog`), RU — под `/ru/...` (`localePrefix: 'as-needed'`, существующие URL не сломаны). Все маршруты перенесены в `app/[locale]/`, `app/api/health` — вне локали
    - Словари: `web/messages/{uz,ru}.json` — единственный источник UI-строк (`lib/labels.ts` удалён). UZ — латиница с корректными oʻ/gʻ/ʼ (U+02BB/02BC, входят в latin-подмножество Inter — риск FE-R-3 по глифам закрыт)
    - `LanguageSwitcher` в шапке: `router.replace(..., { locale })` — переключение **без перезагрузки** (NFR-28, проверено Playwright: window-маркер выживает, query-параметры фильтров сохраняются). Внутренние ссылки — только через `@/i18n/navigation` (Link/useRouter), иначе переход сбрасывает язык
    - `lib/format.ts` принимает локаль: «1 000 000 сум» / «1 000 000 soʻm» (NFR-29)
    - Zod-схемы валидации — фабрики `create*Schema(t)` с переводчиком namespace'а `validation` (`lib/validation/translator.ts`); в тестах схем — `createTranslator` из next-intl без React-дерева. Enum-списки значений — `*_VALUES` в `types/listing.ts` (общие для фильтров, селектов wizard'а и схем)
    - Тесты: `src/test/utils.tsx` оборачивает всё в `NextIntlClientProvider` с RU-словарём (ассерты остались на русских строках); vitest инлайнит `next-intl`/`use-intl` (ESM-сабпат `next/navigation`); моки роутера в тестах форм/wizard'а — на `@/i18n/navigation`, не `next/navigation`. 132/132 зелёные
    - **Найдено и исправлено при живой проверке**: пустая форма характеристик показывала 5 непереводимых zod-дефолтов «Invalid input» (NaN у нетронутых `z.coerce.number()`, `''` у невыбранных `z.enum()`-селектов) — добавлены `*Required`-сообщения в обе локали (существовало и до i18n)
    - **Хвосты i18n**: мок-данные (города «Ташкент», цвета, описания объявлений) остаются русскими строками данных — локализуются вместе с реальным Core API
14. **Первые CI-гейты и тестовые хвосты — 2026-07-11**:
    - `.github/workflows/ci.yml` — на каждый push/PR: typecheck, lint, vitest, production build (remote: github.com/shukhratbekovb/carsale)
    - Гейт «0 непереведённых строк» на уровне словарей — `web/messages/parity.test.ts` (одинаковые наборы ключей uz/ru, нет пустых сообщений, ICU-аргументы совпадают)
    - a11y-смоук (WCAG 2.1 AA) — `web/src/test/a11y.test.tsx` на vitest-axe: Header/Footer, ListingCard, CatalogFilters, форма характеристик wizard'а; color-contrast выключен (jsdom), полный axe-аудит живых страниц остаётся в FE-10
    - `select-field.test.tsx` — закрыт последний тестовый хвост FE-3 (написан test-agent'ом); итого 145 тестов
    - **Не поднято из CI-гейтов**: bundlewatch (нужны бюджеты) и lighthouse-ci (нужен запуск сервера в CI) — следующие кандидаты; e2e Playwright-сценарии — FE-10
    - CI на GitHub подтверждён зелёным на `origin/main` (github.com/shukhratbekovb/carsale) — первый прогон падал на `npm ci` (lockfile сгенерирован npm 11, раннер Actions даёт npm 10 по умолчанию для node 22), пофикшено явным `npm install -g npm@^11` перед `npm ci`
15. **`/favorites` и `/my-listings` — закрыты битые ссылки шапки, 2026-07-14**:
    - `/favorites` (P1, FR-13) — полноценная frontend-only фича: `useFavorites` поверх `useLocalStorage` (персистентность «на этом устройстве», не между устройствами — до Core API), `FavoriteButton` оверлеем на фото в `ListingCard`/`ListingRow`/детальной странице объявления (вынесен за пределы `<Link>`, как `MileageFlag`), страница со списком либо empty-state
    - `/my-listings` (P0, FR-05/UC-12, auth-walled dashboard по плану) — честный auth-гейт вместо подделки данных: в приложении **нигде нет понятия «текущий продавец»** (OTP-флоу не сохраняет состояние входа, JWT-сессия заблокирована отсутствием Core API — см. п.11), поэтому страница ведёт на `/auth/login?return=/my-listings` + запасной CTA на `/sell/new`. Настоящий дашборд подключится вместе с сессией
    - **Побочный найденный и исправленный баг**: `useLocalStorage` (общий хук, использует и `LocationPicker`, и новый `useFavorites`) читал `localStorage` прямо в `useState`-инициализаторе — на клиенте это происходит до гидратации, и при непустом сохранённом значении клиентский первый рендер расходился с серверным HTML (React hydration mismatch, `Text content did not match`). Баг существовал и до этой сессии, просто не был так заметен (дефолтный город часто совпадает с реальным). Исправлено: первый рендер всегда `initialValue`, реальное значение подхватывается в `useEffect` после монтирования
    - Тесты: `use-favorites.test.ts`, `favorite-button.test.tsx`, `favorites/page.test.tsx` (test-agent) + `my-listings/page.test.tsx` — итого 158/158 тестов зелёные

## В работе / следующий шаг

Согласно frontend-plan.md §13 и §11:

- **FE-3 в процессе** — каркас данных/UI/тестов готов и проверен вживую (см. п.12 выше); дальше — доп. UI-полировка (a11y для overlay блюра, возможно drag-корректировка вместо числовых полей) по мере необходимости, и интеграция с реальным Core API/ML-сервисами, когда бэкенд появится
- **i18n закрыт** (см. п.13) — двуязычность больше не блокирует новые страницы; новые компоненты обязаны брать строки из `messages/{uz,ru}.json` и ссылки из `@/i18n/navigation`
- **Битых ссылок в навигации не осталось** (см. п.15) — все пункты шапки (`/catalog`, `/favorites`, `/my-listings`, `/sell/new`, `/auth/login`) ведут на реальные страницы
- **Следующий кандидат по критическому пути** (frontend-plan.md §11): **FE-6 Оплата** — экран выбора шлюза Click/Payme (оба с первого дня, решение зафиксировано 2026-07-05), redirect-flow для обоих, return-страница, обработка отклонённого платежа, fallback на второй шлюз. Полностью мокается без бэкенда
- **Не поднято**: bundlewatch/lighthouse-ci (следующие CI-гейты), e2e Playwright-сценарии (FE-10), FE-5 Чат (WebSocket, крупнее)

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
