# Carsale — Backend-план (Core API + ML Service)

> Версия: 1.0 · Дата: 2026-07-18 · Источники: [PRD](PRD.md), [09-architecture.md](analysis/09-architecture.md), [08-data-model.md](analysis/08-data-model.md), [10-integrations-api.md](analysis/10-integrations-api.md), [06-sequence-diagrams.md](analysis/06-sequence-diagrams.md), [07-process-and-state.md](analysis/07-process-and-state.md), [13-delivery-plan.md](analysis/13-delivery-plan.md), [ADR-006](analysis/14-adr/ADR-006-modular-monolith.md)

Frontend (эпики FE-1–FE-10) закрыт целиком — см. [HANDOFF.md](HANDOFF.md). Все интеграционные точки фронта замоканы в `web/lib/mock/**` и типизированы в `web/types/**` — **это согласованные контракты**: backend обязан реализовать ту же форму данных, иначе интеграция потребует переделки фронта.

## 1. Стек и ключевые решения

| Слой | Выбор | Обоснование |
|------|-------|-------------|
| Core API | **Node.js 22 + TypeScript strict + Express** | ADR-006 (модульный монолит); один язык с фронтом, общая Zod-идиома валидации |
| ORM / миграции | **Prisma + PostgreSQL 15** | Схема выводится напрямую из [08-data-model.md](analysis/08-data-model.md); типобезопасность end-to-end |
| Кэш / OTP / rate limit / сессии | **Redis 7** | 09-architecture §3 |
| Очередь | **RabbitMQ** (amqplib) | async fraud_check, уведомления; at-least-once (09-architecture §5) |
| Фото | **MinIO (S3 API)**: originals private + blurred public → CDN | BR-3, NFR-8; UZ-хостинг (ADR-004) |
| Real-time | **Socket.IO** WebSocket Hub | §6.4; фронт осознанно ждал реального хаба (HANDOFF п.17) |
| ML Service | **Python 3.12 + FastAPI**; LightGBM (Deal Rating), YOLO/OpenCV (блюр), pHash (дубли) | 09-architecture; ADR-003 (синтетический seed) |
| Валидация | **Zod** на границе API | та же идиома, что `web/lib/validation/**` |
| Логи / трейсинг | **pino** JSON + `X-Request-ID` сквозной | NFR-25/27 |
| Тесты | **Vitest + supertest** (api), **pytest** (ml) | симметрия с web/ |
| Auth | JWT access 15 мин + refresh 30 дней (httpOnly, Redis-инвалидация), RBAC middleware | 09-architecture §5 |

Формат ошибок — единый: `{ error, code, details? }`, статусы 400/401/403/404/429/503 (09-architecture §5). Ошибки внешних сервисов — graceful degradation, не 500.

## 2. Структура репозитория

```
api/            Core API — модульный монолит (Express + TS)
  prisma/       schema.prisma + миграции (все сущности 08-data-model)
  src/
    config/     env (Zod-валидация), константы
    lib/        logger, errors, http-клиенты
    middleware/ request-id, error-handler, auth, rbac, rate-limit
    modules/    auth | listing | catalog | chat | payment | notification | user | admin
                (каждый: router → service → repository; межмодульно — только через публичный интерфейс модуля, не через чужие таблицы — ADR-006)
ml/             ML Service (FastAPI): /v1/deal-rating, /v1/blur, /v1/fraud-check
infra/          docker-compose.yml (postgres, redis, rabbitmq, minio) + init-скрипты
web/            frontend (готов)
```

## 3. Эпики и подзадачи

Обозначения: **[P]** — задача не зависит от соседних по списку той же волны и может выполняться субагентом параллельно; «→ X» — жёсткая зависимость. Оценки: S ≤ 1 дня, M 1–3 дня, L 3–5 дней.

### BE-0 — Каркас и инфраструктура (аналог Epic 1)

| ID | Задача | Оценка | Зависимости |
|----|--------|--------|-------------|
| BE-0.1 | Скаффолд `api/`: Express + TS strict, pino, `/health`, vitest smoke | S | — |
| BE-0.2 | **[P]** `infra/docker-compose.yml`: PostgreSQL, Redis, RabbitMQ, MinIO | S | — |
| BE-0.3 | Prisma-схема всех 10 сущностей ([08-data-model.md](analysis/08-data-model.md)) + первая миграция + индексы | M | → BE-0.2 |
| BE-0.4 | **[P]** Zod-валидированный env-конфиг (`src/config/env.ts`), `.env.example`, секреты вне репо | S | → BE-0.1 |
| BE-0.5 | **[P]** Middleware: `X-Request-ID`, error-handler `{error, code, details}` | S | → BE-0.1 |
| BE-0.6 | **[P]** CI-workflow `api`: typecheck, lint, vitest, `prisma validate` | S | → BE-0.1 |
| BE-0.7 | **[P]** Rate-limit middleware на Redis: 60 RPS/IP гость, 300 RPS/юзер (NFR-14) | M | → BE-0.2 |
| BE-0.8 | **[P]** Клиенты-обёртки: Redis, RabbitMQ (publish/consume + reconnect), S3/MinIO | M | → BE-0.2 |

### BE-1 — Auth (FR-01, §6.1, аналог Epic 2)

| ID | Задача | Оценка | Зависимости |
|----|--------|--------|-------------|
| BE-1.1 | **[P]** Порт `SmsGateway` + EskizAdapter (retry 2с/5с, timeout 5с → `sms_unavailable` 503) + MockAdapter для dev/тестов | M | → BE-0.4 |
| BE-1.2 | **[P]** OTP-сервис на Redis: hash кода, TTL 300с, cooldown 60с, 3 попытки → lock 15 мин | M | → BE-0.8 |
| BE-1.3 | `POST /auth/otp/send`, `POST /auth/otp/verify` — контракт §6.1 (совпадает с `web/lib/mock/otp.ts`) | M | → BE-1.1, BE-1.2, BE-0.3 |
| BE-1.4 | JWT: access 15 мин + refresh 30 дней httpOnly cookie, refresh в Redis, logout-инвалидация, rotation | M | → BE-1.3 |
| BE-1.5 | **[P]** RBAC middleware: GUEST/BUYER/SELLER/ADMIN | S | → BE-1.4 |
| BE-1.6 | **[P]** `phone_hash` Argon2 + детерминированный поиск (NFR-15); raw-телефон не логируется | S | → BE-0.3 |
| BE-1.7 | Тесты полного OTP-флоу: неверный код ×3 → lock, resend-cooldown, refresh rotation | M | → BE-1.4 |

### BE-2 — ML Service v1 (FR-03/05/06/07, аналог Epic 3) — **весь эпик параллелен BE-1…BE-4** (другой стек, другой субагент)

| ID | Задача | Оценка | Зависимости |
|----|--------|--------|-------------|
| BE-2.1 | Скаффолд `ml/`: FastAPI, `/health`, pytest, Dockerfile | S | — |
| BE-2.2 | Синтетический seed-датасет цен (ADR-003): генератор по маркам/годам/пробегам UZ-рынка | M | — [P] с BE-2.1 |
| BE-2.3 | **[P]** Deal Rating: LightGBM на seed + `POST /v1/deal-rating` (контракт [10-integrations-api.md](analysis/10-integrations-api.md) §2.4, SLA p95 < 1с; MAPE ≤ 15%) | L | → BE-2.1, BE-2.2 |
| BE-2.4 | **[P]** Блюр номера/VIN: YOLO fine-tune или OpenCV + `POST /v1/blur` (SLA p95 < 5с, ≥95% detection) | L | → BE-2.1 |
| BE-2.5 | **[P]** Fraud: pHash дублей + rule «цена < 40% медианы» | M | → BE-2.1 |
| BE-2.6 | Queue-consumer `fraud_check` → результат в очередь (контракт §2.4) | M | → BE-2.5, BE-0.2 |
| BE-2.7 | Интеграционные тесты ML API + контрактные фикстуры для Core API | M | → BE-2.3–2.6 |

### BE-3 — Listings (FR-02/03/05, §6.2, statuses [07 §2.1](analysis/07-process-and-state.md), аналог Epic 4)

| ID | Задача | Оценка | Зависимости |
|----|--------|--------|-------------|
| BE-3.1 | **[P]** CRUD черновиков: `POST /listings/draft`, `PUT /listings/{id}`, `GET /my/listings` | M | → BE-1.4, BE-0.3 |
| BE-3.2 | **[P]** Статусная машина Listing (DRAFT→PENDING_MODERATION→PUBLISHED/REJECTED/ARCHIVED/SOLD/EXPIRED) — чистый модуль + тесты переходов | M | → BE-0.3 |
| BE-3.3 | Фото: multipart → ML `/v1/blur` → MinIO (original private, blurred public) → PHOTO; лимит 20; ручная корректировка области | L | → BE-3.1, BE-2.4, BE-0.8 |
| BE-3.4 | **[P]** `POST /listings/{id}/price-estimate` → ML deal-rating, timeout 1.5с → UNAVAILABLE (контракт = `web/lib/mock/price-estimate.ts`) | M | → BE-3.1, BE-2.3 |
| BE-3.5 | `POST /listings/{id}/publish` → 202, событие `fraud_check` в очередь | S | → BE-3.2 |
| BE-3.6 | Consumer результата fraud: PUBLISHED или PENDING_MODERATION + ML_RESULT + уведомление | M | → BE-3.5, BE-2.6 |
| BE-3.7 | **[P]** Scheduler: EXPIRED (published + 30 дней), Deal Rating retry 5 мин (UNAVAILABLE) | M | → BE-3.2 |
| BE-3.8 | **[P]** Пересчёт Deal Rating при изменении цены + повторная модерация при смене цены/фото | S | → BE-3.4 |

### BE-4 — Catalog (FR-04, §6.6, аналог Epic 5)

| ID | Задача | Оценка | Зависимости |
|----|--------|--------|-------------|
| BE-4.1 | `GET /listings`: фильтры (марка/модель/год/цена/пробег/КПП/привод/Deal Rating/город/статус продавца), сортировка, пагинация — контракт = `web/lib/catalog/**` | M | → BE-0.3 |
| BE-4.2 | **[P]** Redis-кэш каталога TTL 60с + инвалидация при публикации | S | → BE-4.1 |
| BE-4.3 | **[P]** «Похожие» relaxed query при пустой выдаче | S | → BE-4.1 |
| BE-4.4 | **[P]** `GET /listings/{id}` — публичная карточка: ML-флаги в том же ответе (FR-07/NFR-2, HANDOFF «Ключевые решения»), VIN/госномер не отдаются (BR-3) | S | → BE-4.1 |
| BE-4.5 | Синтетика 1М строк + проверка p95 < 2с (NFR-1/9), тюнинг индексов | M | → BE-4.2 |

### BE-5 — Chat (FR-09, §6.4, аналог Epic 6)

| ID | Задача | Оценка | Зависимости |
|----|--------|--------|-------------|
| BE-5.1 | REST: threads (UNIQUE listing+buyer), messages — контракт = `web/lib/mock/chat.ts` (`GET /chat/threads`, `POST /chat/threads/{id}/messages`) | M | → BE-1.4, BE-0.3 |
| BE-5.2 | **[P]** WebSocket Hub (Socket.IO) + JWT handshake + rooms per thread | M | → BE-1.4 |
| BE-5.3 | Событие `new_message` через Hub; офлайн-получатель → notify-событие в очередь | S | → BE-5.1, BE-5.2 |
| BE-5.4 | **[P]** Read receipts + unread counts | S | → BE-5.1 |

### BE-6 — Payments (FR-10, §6.5, ADR-002, аналог Epic 7)

| ID | Задача | Оценка | Зависимости |
|----|--------|--------|-------------|
| BE-6.1 | **[P]** Порт `PaymentGateway` + Click-адаптер: create invoice, webhook + MD5/HMAC-подпись ([10 §2.2](analysis/10-integrations-api.md)) | M | → BE-0.4 |
| BE-6.2 | **[P]** Payme-адаптер (тот же порт) | M | → BE-0.4 |
| BE-6.3 | `POST /payments/create` + статусная машина Payment ([07 §2.3](analysis/07-process-and-state.md)) — контракт = `web/types/payment.ts` | M | → BE-6.1, BE-0.3 |
| BE-6.4 | Webhook-эндпоинты, идемпотентность по `gateway_transaction_id`, replay → 200 | M | → BE-6.3 |
| BE-6.5 | **[P]** Polling fallback: scheduler опрашивает статус, если webhook не пришёл за 5 мин | S | → BE-6.3 |
| BE-6.6 | Квитанция на email через notification-событие | S | → BE-6.4, BE-7.2 |

### BE-7 — Notifications (FR-11, аналог Epic 8) — **параллелен BE-5/BE-6**

| ID | Задача | Оценка | Зависимости |
|----|--------|--------|-------------|
| BE-7.1 | Queue-consumer + персистенция NOTIFICATION; ретеншн 30 дней | M | → BE-0.8, BE-0.3 |
| BE-7.2 | **[P]** Email-адаптер (SES/SendGrid) + шаблоны UZ/RU (словари фронта как источник терминологии) | M | → BE-7.1 |
| BE-7.3 | **[P]** Web Push (VAPID/Firebase) + хранение подписок | M | → BE-7.1 |
| BE-7.4 | **[P]** Per-type preferences API — контракт = `web/types/notification.ts` (тип отключён → не создаётся, HANDOFF п.19) | S | → BE-7.1 |

### BE-8 — Admin (UC-15/16/17, аналог Epic 9)

| ID | Задача | Оценка | Зависимости |
|----|--------|--------|-------------|
| BE-8.1 | Очередь модерации: PENDING oldest-first, детали флага (оригинал дубля / % отклонения цены) — контракт = `web/lib/mock/admin.ts` | M | → BE-3.6, BE-1.5 |
| BE-8.2 | approve/reject (+причина из `REJECT_REASON_VALUES`) → статус + уведомление продавцу | M | → BE-8.1 |
| BE-8.3 | **[P]** Users: suspend/ban/restore, маскированный телефон (BR-3/NFR-15) | S | → BE-1.5 |
| BE-8.4 | **[P]** Аналитика-счётчики (контракт = `mockFetchAnalytics`) | S | → BE-0.3 |
| BE-8.5 | Аудит-лог действий админа | S | → BE-8.2 |

### BE-9 — Profile / GDPR (NFR-18–21, ЗРУ-547, аналог Epic 10)

| ID | Задача | Оценка | Зависимости |
|----|--------|--------|-------------|
| BE-9.1 | Профиль + согласия: фиксация при регистрации, отзыв маркетинга (контракт = `web/lib/gdpr/consent.ts`) | M | → BE-1.4 |
| BE-9.2 | **[P]** Экспорт данных пользователя (все сущности, JSON) — серверная замена device-scope экспорта фронта | M | → BE-9.1 |
| BE-9.3 | **[P]** Удаление: soft delete + анонимизация (listing.seller_id остаётся), SLA 15 раб. дней, тикет-трекинг | M | → BE-9.1 |

### BE-10 — QA / Security / Ops (аналог Epic 11)

| ID | Задача | Оценка | Зависимости |
|----|--------|--------|-------------|
| BE-10.1 | **[P]** k6: 10K сессий, p95 ≤ 2с (NFR-1) | M | → BE-4 |
| BE-10.2 | **[P]** SAST в CI + подготовка pentest OWASP (NFR-16) | M | → BE-0.6 |
| BE-10.3 | **[P]** Бэкапы hourly + квартальный restore drill (NFR-11) | S | → BE-0.2 |
| BE-10.4 | **[P]** Prometheus-метрики + Grafana + алерты ≤ 1 мин (NFR-26) | M | → BE-0.5 |
| BE-10.5 | **[P]** TLS-конфиг A+ (NFR-12), заголовки безопасности | S | → BE-0.1 |

## 4. Карта параллелизации (волны для субагентов)

Внутри волны все пункты независимы; следующая волна стартует, когда готовы её зависимости (не обязательно вся предыдущая волна).

| Волна | Параллельные потоки |
|-------|---------------------|
| 0 | BE-0.1 ∥ BE-0.2 ∥ BE-2.1 ∥ BE-2.2 |
| 1 | BE-0.3 ∥ BE-0.4 ∥ BE-0.5 ∥ BE-0.6 ∥ BE-0.7 ∥ BE-0.8 |
| 2 | BE-1.1 ∥ BE-1.2 ∥ BE-1.6 ∥ BE-2.3 ∥ BE-2.4 ∥ BE-2.5 |
| 3 | BE-1.3→1.4→1.5/1.7 ∥ BE-3.2 ∥ BE-4.1 ∥ BE-2.6→2.7 |
| 4 | BE-3.1→3.3/3.4/3.5 ∥ BE-4.2/4.3/4.4 ∥ BE-6.1 ∥ BE-6.2 ∥ BE-7.1 |
| 5 | BE-3.6/3.7/3.8 ∥ BE-5.1/5.2 ∥ BE-6.3→6.4/6.5 ∥ BE-7.2/7.3/7.4 |
| 6 | BE-5.3/5.4 ∥ BE-6.6 ∥ BE-8.1→8.2/8.5 ∥ BE-8.3/8.4 ∥ BE-9.1→9.2/9.3 |
| 7 | BE-10.* ∥ интеграция фронта (замена `web/lib/mock/**` на реальные вызовы, поэпически) |

Критический путь: BE-0.1/0.2 → BE-0.3 → BE-1.3 → BE-3.1 → BE-3.3/3.5 → BE-3.6 → BE-8.1 → launch. ML-ветка (BE-2) — второй длинный путь, полностью параллельный до стыковки в BE-3.3/3.4/3.6.

**Рекомендация по субагентам** (по прецеденту `.claude/agents/{ui,data,test}-agent.md`): завести `api-agent` (`api/src/**`), `ml-agent` (`ml/**`), переиспользовать `test-agent` с расширением scope на `api/**/*.test.ts`. Prisma-схему и контракты модулей менять только через одного агента (или основную сессию) — это общая поверхность, конфликтует при параллельной правке.

## 5. Интеграция с фронтендом

Порядок замены моков (после готовности соответствующего эпика): auth/OTP+JWT-сессия (разблокирует `/my-listings`-дашборд, «текущий пользователь» в чате/избранном) → каталог/карточка → wizard (blur + price-estimate) → чат (Socket.IO вместо mock pub/sub — клиент подключить только теперь, HANDOFF п.17) → платежи → уведомления → admin → GDPR-экспорт/удаление. Каждый шаг — отдельная FE-задача «снять мок», данные мок-фасадов уже повторяют серверные контракты.

## 6. CI-гейты backend

`api`: typecheck strict, eslint, vitest, `prisma validate`, build. `ml`: ruff, pytest, контрактные тесты API. Интеграционные: docker-compose up → миграции → smoke `/health` обоих сервисов → контрактные тесты Core↔ML. Позже: k6-порог, SAST.
