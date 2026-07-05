# Carsale — Архитектура системы (C4 + arc42)

> Версия: 1.0 · Дата: 2026-06-28 · Источник: [PRD](../PRD.md) · Автор: Системный аналитик  
> Стандарт: C4 model + arc42 (облегчённый)

---

## 1. Цели и ограничения архитектуры

### Качественные атрибуты (из NFR)

| Атрибут | Требование | Документ |
|---------|-----------|---------|
| Производительность | Каталог p95 < 2 сек; ML inference < 1 сек; блюр < 5 сек | NFR-1, 2, 3 |
| Доступность | Uptime ≥ 99.5%; RTO ≤ 30 мин | NFR-10 |
| Масштабируемость | Горизонтальное масштабирование каталога и ML | NFR-7 |
| Безопасность | TLS 1.2+; AES-256; rate limiting; OWASP Top 10 | NFR-12, 13, 14, 16 |
| Соответствие | ЗРУ-547: PII только в юрисдикции UZ | NFR-18 |
| Локализация | UZ + RU; CDN в Узбекистане | NFR-8, 28 |

### Ключевые ограничения

- **Хостинг:** физически в Узбекистане (ЗРУ-547, ст. 8) — ADR-004
- **Платформа:** только веб (не мобильное приложение) в MVP — ADR-005
- **Архитектурный стиль:** модульный монолит на старте → микросервисы при необходимости — ADR-006
- **ML:** Python-сервисы, отдельно от основного бэкенда
- **PCI DSS:** данные карт только через шлюз — NFR-17, BR-6

---

## 2. Контекст системы (C4 Level 1)

Система Carsale в окружении пользователей и внешних систем.

```mermaid
C4Context
    title C4 Level 1 — Контекст системы Carsale

    Person(guest, "Гость", "Просматривает каталог и карточки авто")
    Person(buyer, "Покупатель", "Ищет авто, общается с продавцом")
    Person(seller, "Продавец", "Размещает объявления, отвечает на чат")
    Person(admin, "Администратор", "Модерирует фрод-флаги, управляет платформой")

    System(carsale, "Carsale", "Веб-платформа для купли-продажи авто\nс ML-верификацией и Deal Rating")

    System_Ext(eskiz, "Eskiz UZ\n(SMS Gateway)", "Доставка OTP-кодов")
    System_Ext(click, "Click / Payme\n(Payment Gateway)", "Приём онлайн-платежей (PCI DSS)")
    System_Ext(oneid, "OneID\n(gov.uz)", "Государственная верификация личности")
    System_Ext(gubdd, "ГУБДД / Страховые UZ", "История ДТП, штрафов, таможни (P1)")
    System_Ext(llm, "LLM API\n(Claude / OpenAI)", "Генерация описаний, NLP, чат-бот (P1)")
    System_Ext(email, "Email Provider\n(SendGrid / AWS SES)", "Транзакционные письма")
    System_Ext(push, "Push Service\n(Firebase / WebPush)", "Браузерные уведомления")

    Rel(guest, carsale, "Просматривает каталог", "HTTPS")
    Rel(buyer, carsale, "Ищет авто, чат, избранное", "HTTPS")
    Rel(seller, carsale, "Размещает объявления, чат", "HTTPS")
    Rel(admin, carsale, "Модерация, аналитика", "HTTPS")

    Rel(carsale, eskiz, "Отправляет OTP", "REST/HTTPS")
    Rel(carsale, click, "Создаёт платёжные ордера", "REST/HTTPS")
    Rel(carsale, oneid, "OAuth верификация (P1)", "OAuth2/HTTPS")
    Rel(carsale, gubdd, "Запрашивает историю авто (P1)", "REST/HTTPS")
    Rel(carsale, llm, "NLP, генерация текстов (P1)", "REST/HTTPS")
    Rel(carsale, email, "Уведомления, квитанции", "SMTP/API")
    Rel(carsale, push, "Push уведомления", "FCM/WebPush")
```

---

## 3. Контейнеры (C4 Level 2)

Внутренняя структура Carsale: контейнеры (отдельно запускаемые единицы).

```mermaid
C4Container
    title C4 Level 2 — Контейнеры Carsale

    Person(user, "Пользователь\n(Гость / Покупатель / Продавец / Админ)")

    Container_Boundary(carsale, "Carsale Platform") {
        Container(web, "Web Application", "Next.js / React", "SSR + CSR. Рендерит UI,\nобрабатывает пользовательский ввод")

        Container(api, "Core API", "Node.js / Express\n(или FastAPI Python)", "REST API. Аутентификация,\nобъявления, чат, платежи,\nпользователи, уведомления")

        Container(ml, "ML Service", "Python / FastAPI", "Deal Rating, Mileage Flag,\nFraud Detection, Image Blur (CV).\nОтдельный сервис для ML-inference")

        ContainerDb(db, "PostgreSQL", "PostgreSQL 15+", "Основная реляционная БД.\nПользователи, объявления,\nчаты, платежи, ML-результаты")

        ContainerDb(cache, "Redis", "Redis 7+", "Кэш каталога, сессии,\nOTP-коды, rate limiting")

        Container(queue, "Message Queue", "RabbitMQ / Redis Streams", "Асинхронные события:\nfraud_check, notifications,\ndeal_rating_recompute")

        Container(storage, "Object Storage", "S3-совместимое\n(UZ-хостинг)", "Хранение фото объявлений.\nOriginals (private) +\nBlurred (CDN)")

        Container(cdn, "CDN", "Cloudflare / локальный CDN\n(edge в Ташкенте)", "Раздача blurred-фото\nи статики. p95 < 500 мс")

        Container(ws, "WebSocket Hub", "Socket.IO / ws", "Real-time: чат,\nстатус уведомлений")

        Container(scheduler, "Scheduler", "Node-cron / Celery Beat", "Cron-задачи: пересчёт\nDeal Rating, expired listings,\nalert отправка")
    }

    System_Ext(eskiz, "Eskiz UZ")
    System_Ext(payment, "Click / Payme")
    System_Ext(llm, "LLM API")
    System_Ext(email_svc, "Email Provider")
    System_Ext(push_svc, "Push Service")

    Rel(user, web, "Открывает в браузере", "HTTPS")
    Rel(web, api, "API вызовы", "REST/JSON HTTPS")
    Rel(web, ws, "Real-time чат", "WSS")
    Rel(api, db, "Читает/пишет данные", "PostgreSQL")
    Rel(api, cache, "Кэш, сессии, OTP", "Redis protocol")
    Rel(api, queue, "Публикует события", "AMQP / Redis")
    Rel(api, ml, "Sync: blur, deal-rating", "REST/JSON HTTPS")
    Rel(api, storage, "Сохраняет оригиналы фото", "S3 API")
    Rel(api, eskiz, "SMS OTP", "REST HTTPS")
    Rel(api, payment, "Платёжные ордера, webhook", "REST HTTPS")
    Rel(api, email_svc, "Транзакционные письма", "API")
    Rel(api, push_svc, "Push уведомления", "FCM/WebPush")
    Rel(ml, storage, "Читает оригиналы для blur", "S3 API")
    Rel(ml, storage, "Сохраняет blurred-версии", "S3 API")
    Rel(storage, cdn, "Origin для CDN", "HTTPS pull")
    Rel(queue, ml, "Async: fraud_check", "AMQP / Redis")
    Rel(queue, api, "Consume: notifications", "AMQP / Redis")
    Rel(scheduler, api, "Trigger: expired, alerts", "Internal HTTP")
    Rel(api, llm, "NLP, генерация (P1)", "REST HTTPS")
```

### Таблица контейнеров

| Контейнер | Технология | Ответственность |
|-----------|-----------|----------------|
| Web Application | Next.js 14+ (React) | SSR для SEO каталога; CSR для чата и форм; i18n (UZ/RU) |
| Core API | Node.js + Express (или Python FastAPI) | Вся бизнес-логика кроме ML; REST endpoints; JWT auth |
| ML Service | Python + FastAPI | Deal Rating (XGBoost/LightGBM); Blur (OpenCV/YOLO); Fraud (hash + rules) |
| PostgreSQL | PostgreSQL 15+ | Персистентное хранение всех бизнес-данных |
| Redis | Redis 7+ | Кэш каталога (TTL 60 сек); OTP (TTL 5 мин); сессии; rate limits |
| Message Queue | RabbitMQ или Redis Streams | Декуплинг: async fraud check, уведомления, фоновые задачи |
| Object Storage | S3-совместимое (MinIO или облако UZ) | Фото (оригинал private + blurred public) |
| CDN | Cloudflare / Local CDN | Edge-раздача фото; статика Web App |
| WebSocket Hub | Socket.IO | Real-time чат и push в браузере |
| Scheduler | node-cron / Celery Beat | EXPIRED listings; deal_rating retry; price alert jobs |

---

## 4. Компоненты Core API (C4 Level 3)

Декомпозиция наиболее критичного контейнера.

```mermaid
C4Component
    title C4 Level 3 — Компоненты Core API

    Container_Boundary(api, "Core API") {
        Component(auth, "Auth Module", "SMS OTP, JWT, Session", "Регистрация, вход, выход,\nobработка токенов")
        Component(listing, "Listing Module", "CRUD объявлений", "Создание, публикация,\nредактирование, архивация,\nкаталог с фильтрами")
        Component(ml_client, "ML Client", "HTTP client", "Синхронные вызовы ML-сервиса:\nblur, deal-rating")
        Component(fraud, "Fraud Module", "Queue publisher", "Публикует fraud_check события;\nобрабатывает результаты")
        Component(chat, "Chat Module", "WebSocket + REST", "Создание тредов,\nсообщения, read receipts")
        Component(payment, "Payment Module", "Webhook handler", "Создание ордеров,\nобработка webhooks, квитанции")
        Component(notification, "Notification Module", "Email + Push", "Оркестрация уведомлений\n(email, push, in-app)")
        Component(user, "User Module", "Profile, GDPR", "Профиль, настройки,\nудаление аккаунта (ЗРУ-547)")
        Component(admin, "Admin Module", "Moderation panel", "Просмотр очереди,\nодобрение/отклонение,\nаналитика")
    }

    ContainerDb(db, "PostgreSQL")
    ContainerDb(cache, "Redis")
    Container(queue, "Queue")
    Container(ml_svc, "ML Service")
    Container(ws, "WebSocket Hub")
    System_Ext(eskiz, "Eskiz UZ")
    System_Ext(pay_gw, "Click/Payme")
    System_Ext(email_p, "Email Provider")
    System_Ext(push_p, "Push Service")

    Rel(auth, db, "Users, Sessions")
    Rel(auth, cache, "OTP, Rate limit")
    Rel(auth, eskiz, "SMS OTP")
    Rel(listing, db, "Listings, Vehicles, Photos")
    Rel(listing, cache, "Catalog cache")
    Rel(listing, ml_client, "Blur + Deal Rating")
    Rel(listing, fraud, "Trigger fraud check")
    Rel(ml_client, ml_svc, "REST calls")
    Rel(fraud, queue, "Publish fraud_check")
    Rel(chat, db, "Threads, Messages")
    Rel(chat, ws, "Real-time events")
    Rel(payment, db, "Payments")
    Rel(payment, pay_gw, "Create order, receive webhook")
    Rel(notification, email_p, "Email")
    Rel(notification, push_p, "Push")
    Rel(notification, queue, "Consume notify events")
    Rel(user, db, "Users, GDPR")
    Rel(admin, db, "All entities read")
```

---

## 5. Сквозные концепции (cross-cutting)

### Аутентификация и авторизация
- **AuthN:** JWT (access token 15 мин + refresh token 30 дней в HttpOnly cookie)
- **AuthZ:** RBAC на уровне API middleware; роли: GUEST / BUYER / SELLER / ADMIN
- **Сессии:** refresh token в Redis (можно инвалидировать при logout)

### Обработка ошибок
- Все ошибки возвращаются в формате `{ error: string, code: string, details?: object }`
- HTTP статусы: 400 (validation), 401 (unauth), 403 (forbidden), 404 (not found), 429 (rate limit), 503 (dependency unavailable)
- Ошибки внешних сервисов (Eskiz, LLM) — graceful degradation, не 500

### Логирование и observability
- Структурированные JSON-логи (Winston / structlog); уровни: ERROR/WARN/INFO/DEBUG
- Trace ID сквозной через все сервисы (X-Request-ID header)
- Метрики в Prometheus → Grafana: RPS, latency p50/p95/p99, error rate, queue depth

### Транзакции
- Бизнес-транзакции в PostgreSQL (ACID); queue events — at-least-once delivery
- Идемпотентные webhook handlers (payment, fraud) — проверка по `gateway_transaction_id`

### Конфигурация
- Секреты в environment variables / Vault; не в коде и не в репозитории
- Feature flags: монетизация (FR-14) включается конфигом без деплоя

---

## 6. Развёртывание (deployment, высокий уровень)

```mermaid
flowchart TD
    subgraph UZ_DC["Дата-центр Узбекистан (физически)"]
        subgraph Prod["Production окружение"]
            LB[Load Balancer / Reverse Proxy\nnginx / Caddy]
            subgraph AppCluster["App Cluster (горизонтальное масштабирование)"]
                WEB1[Web App\nInstance 1]
                WEB2[Web App\nInstance 2]
                API1[Core API\nInstance 1]
                API2[Core API\nInstance 2]
                ML1[ML Service\nInstance 1]
                ML2[ML Service\nInstance 2]
            end
            subgraph DataLayer["Data Layer"]
                PG_PRIMARY[(PostgreSQL\nPrimary)]
                PG_REPLICA[(PostgreSQL\nReplica)]
                REDIS[(Redis Cluster)]
                MQ[(RabbitMQ)]
                OBJ[Object Storage\nMinIO / S3-compatible]
            end
            WS_HUB[WebSocket Hub]
            SCHED[Scheduler]
        end
        CDN_EDGE[CDN Edge\nТашкент]
    end

    subgraph External["Внешние сервисы"]
        ESKIZ[Eskiz UZ]
        CLICK[Click / Payme]
        EMAIL[SendGrid / SES]
        PUSH[Firebase / WebPush]
    end

    Internet((Интернет)) --> CDN_EDGE --> LB
    LB --> WEB1 & WEB2
    LB --> API1 & API2
    WEB1 & WEB2 --> API1 & API2
    API1 & API2 --> ML1 & ML2
    API1 & API2 --> PG_PRIMARY
    API1 & API2 --> REDIS
    API1 & API2 --> MQ
    ML1 & ML2 --> OBJ
    PG_PRIMARY --> PG_REPLICA
    MQ --> ML1 & ML2
    API1 & API2 --> WS_HUB
    API1 & API2 --> ESKIZ & CLICK & EMAIL & PUSH
```

**Окружения:**

| Окружение | Назначение |
|-----------|-----------|
| `local` | Разработка; docker-compose с PostgreSQL, Redis, MinIO |
| `staging` | Интеграционное тестирование; полная копия prod без CDN |
| `production` | Боевая; UZ дата-центр; горизонтальное масштабирование |

---

## 7. Архитектурные решения (ADR)

Полные тексты ADR — в директории [14-adr/](14-adr/).

| ADR | Решение | Статус |
|-----|---------|--------|
| [ADR-001](14-adr/ADR-001-sms-gateway.md) | SMS-шлюз: Eskiz UZ | Принято |
| [ADR-002](14-adr/ADR-002-payment-gateway.md) | Платёжный шлюз: Click + Payme | Принято |
| [ADR-003](14-adr/ADR-003-ml-seed-dataset.md) | Стратегия ML seed-датасета: синтетическая генерация | Принято |
| [ADR-004](14-adr/ADR-004-uz-hosting.md) | Хостинг только в юрисдикции UZ (ЗРУ-547) | Принято |
| [ADR-005](14-adr/ADR-005-web-first.md) | Web-first архитектура: нет мобильного приложения в MVP | Принято |
| [ADR-006](14-adr/ADR-006-modular-monolith.md) | Модульный монолит как стартовая архитектура | Принято |
