# Carsale — Sequence-диаграммы

> Версия: 1.0 · Дата: 2026-06-28 · Источник: [PRD](../PRD.md) · Автор: Системный аналитик

Диаграммы покрывают P0 use cases: happy path и значимые ошибочные сценарии.  
Участники согласованы с контейнерами из [09-architecture.md](09-architecture.md).

---

## 6.1 Регистрация через SMS OTP (UC-03)

Сценарий: новый пользователь вводит номер телефона и подтверждает OTP.

```mermaid
sequenceDiagram
    autonumber
    actor U as Пользователь
    participant FE as Web Frontend
    participant API as Auth API
    participant DB as PostgreSQL
    participant SMS as Eskiz UZ (SMS)

    U->>FE: Вводит номер +998XXXXXXXXX
    FE->>API: POST /auth/otp/send { phone }
    activate API
    API->>API: Валидация формата номера
    API->>DB: Проверить: номер существует? + rate limit
    DB-->>API: Результат
    API->>SMS: POST /message/sms/send { phone, text: "Код: 123456" }
    SMS-->>API: 200 OK { message_id }
    API->>DB: Сохранить OTP-хеш (TTL 5 мин, attempts=0)
    API-->>FE: 200 { expires_in: 300 }
    deactivate API
    FE-->>U: Экран ввода кода

    U->>FE: Вводит OTP 123456
    FE->>API: POST /auth/otp/verify { phone, otp }
    activate API
    API->>DB: Получить OTP-запись, проверить хеш + TTL + attempts
    DB-->>API: OTP валиден
    API->>DB: Upsert USER (создать если нет), удалить OTP-запись
    API->>DB: Создать Session (JWT refresh token)
    API-->>FE: 200 { access_token, refresh_token, user }
    deactivate API
    FE-->>U: Главная страница (аутентифицирован)

    alt OTP неверный (< 3 попыток)
        API->>DB: Increment attempts
        API-->>FE: 400 { error: "invalid_otp", attempts_left: N }
        FE-->>U: "Неверный код, осталось N попыток"
    end

    alt 3 неверных попытки
        API->>DB: Заблокировать OTP на 15 мин
        API-->>FE: 429 { error: "otp_locked", retry_after: 900 }
        FE-->>U: "Слишком много попыток. Повторите через 15 мин"
    end

    alt Eskiz UZ недоступен
        SMS-->>API: Timeout / 5xx
        API-->>FE: 503 { error: "sms_unavailable" }
        FE-->>U: "Не удалось отправить SMS. Попробуйте позже"
    end
```

**Участники:** Web Frontend (React/Next.js) → Auth API (Node.js) → PostgreSQL → Eskiz UZ (внешний)  
**Допущение:** JWT access token — short-lived (15 мин), refresh token — long-lived (30 дней), хранится в HttpOnly cookie.

---

## 6.2 Размещение объявления (UC-08) — happy path

Сценарий: аутентифицированный продавец заполняет форму, загружает фото, получает Deal Rating, публикует.

```mermaid
sequenceDiagram
    autonumber
    actor S as Продавец
    participant FE as Web Frontend
    participant API as Listing API
    participant ML as ML Service
    participant CDN as Object Storage / CDN
    participant DB as PostgreSQL
    participant Q as Message Queue
    participant N as Notification Service

    S->>FE: Заполняет форму (марка, модель, год, пробег, цена...)
    S->>FE: Загружает фото (до 20 шт.)
    FE->>API: POST /listings/draft { form_data }
    API->>DB: Сохранить черновик Listing (status=DRAFT)
    DB-->>API: listing_id

    loop Для каждого фото
        FE->>API: POST /photos/upload (multipart)
        API->>ML: POST /ml/blur { photo_binary }
        activate ML
        ML-->>API: { blurred_url, original_url, plate_detected: true }
        deactivate ML
        API->>CDN: Сохранить blurred-версию
        CDN-->>API: blurred_photo_url
        API->>DB: Photo(listing_id, blurred_url, original_stored_internally)
        API-->>FE: { photo_id, blurred_preview_url }
        FE-->>S: Превью с блюром
    end

    S->>FE: Нажимает "Получить оценку цены"
    FE->>API: POST /listings/{id}/price-estimate
    API->>ML: POST /ml/deal-rating { make, model, year, mileage, condition, region, price }
    activate ML
    ML-->>API: { label: "FAIR_PRICE", score: 0.87, min_price: 9500, max_price: 11000 }
    deactivate ML
    API-->>FE: { deal_rating, recommended_range }
    FE-->>S: "Рекомендованная цена: $9 500 – $11 000. Ваша цена: $10 200 (Честная цена)"

    S->>FE: Нажимает "Опубликовать"
    FE->>API: POST /listings/{id}/publish
    API->>Q: Publish event: { listing_id, action: "fraud_check" }
    API->>DB: Listing.status = PENDING_MODERATION
    API-->>FE: 202 Accepted { status: "pending_moderation" }
    FE-->>S: "Объявление отправлено на проверку"

    Note over Q,ML: Асинхронная проверка фрода
    Q->>ML: Consume event fraud_check
    activate ML
    ML->>DB: Загрузить хеши фото всех активных объявлений
    ML->>ML: Проверить image hash на дубли
    ML->>ML: Цена vs рыночная медиана (> 40%? OK)
    ML->>DB: Обновить Listing: fraud_flag=false, mileage_flag=false
    ML->>DB: Listing.status = PUBLISHED
    deactivate ML
    ML->>Q: Publish event: { listing_id, action: "notify_published" }
    Q->>N: Consume event notify_published
    N-->>S: Push/Email "Ваше объявление опубликовано"
```

**Участники:** Web Frontend → Listing API → ML Service (sync для blur и deal-rating; async для fraud) → PostgreSQL → CDN → Queue → Notification Service  
**Допущение:** Блюр и Deal Rating — синхронные вызовы (пользователь ждёт). Fraud check — асинхронный (через очередь), чтобы не блокировать UI.

---

## 6.3 Размещение с фрод-флагом (UC-08, ошибочный путь)

Сценарий: объявление задетектировано как фрод (дубль фото) — скрывается, уходит на модерацию.

```mermaid
sequenceDiagram
    autonumber
    actor S as Продавец
    actor A as Администратор
    participant API as Listing API
    participant ML as ML Service
    participant DB as PostgreSQL
    participant Q as Message Queue
    participant N as Notification Service

    Note over ML,DB: Асинхронная проверка (после шага "publish" из UC-08)
    Q->>ML: Consume fraud_check event
    ML->>DB: Загрузить photo hashes активных объявлений
    ML->>ML: perceptual_hash(photo) == existing_hash → MATCH
    ML->>DB: Listing.fraud_flag = true, fraud_reason = "duplicate_photo", status = PENDING_MODERATION
    ML->>Q: Publish: { listing_id, action: "notify_fraud_pending" }
    Q->>N: Consume notify_fraud_pending
    N-->>S: Email/Push "Ваше объявление требует проверки: похожее фото уже используется"

    Note over A,DB: Модерация (UC-15)
    A->>DB: Загрузить список PENDING_MODERATION
    DB-->>A: [{ listing_id, fraud_reason, seller_profile, original_duplicate_url }]
    A->>A: Проверяет объявление и дубль вручную

    alt Администратор одобряет
        A->>API: POST /admin/listings/{id}/approve
        API->>DB: Listing.fraud_flag = false, status = PUBLISHED
        API->>Q: Publish: notify_published
        Q->>N: Consume
        N-->>S: "Ваше объявление опубликовано"
    end

    alt Администратор отклоняет
        A->>API: POST /admin/listings/{id}/reject { reason }
        API->>DB: Listing.status = REJECTED
        API->>Q: Publish: notify_rejected
        Q->>N: Consume
        N-->>S: "Объявление отклонено: дубль фото из объявления #12345"
    end
```

---

## 6.4 Чат продавец ↔ покупатель (UC-06)

Сценарий: покупатель инициирует чат, продавец отвечает.

```mermaid
sequenceDiagram
    autonumber
    actor B as Покупатель
    actor S as Продавец
    participant FE as Web Frontend
    participant API as Chat API
    participant DB as PostgreSQL
    participant WS as WebSocket Hub
    participant N as Notification Service

    B->>FE: Нажимает "Написать" на карточке объявления
    FE->>API: GET /chat/threads?listing_id={id}&buyer_id={me}
    API->>DB: Найти существующий thread
    DB-->>API: null (первый контакт)
    API->>DB: Создать ChatThread { listing_id, buyer_id, seller_id }
    DB-->>API: thread_id
    API-->>FE: { thread_id }
    FE-->>B: Открывает чат-окно

    B->>FE: Вводит сообщение
    FE->>API: POST /chat/threads/{thread_id}/messages { text }
    activate API
    API->>DB: Сохранить Message { thread_id, sender_id=buyer, text, sent_at }
    API->>WS: Emit "new_message" к seller_id (если онлайн)
    API->>N: Notify seller (push + email если офлайн)
    API-->>FE: 201 { message_id, sent_at }
    deactivate API
    FE-->>B: Сообщение отображено

    Note over S,WS: Продавец онлайн — получает real-time
    WS-->>S: { thread_id, message: { text, sender: "buyer", sent_at } }
    S->>FE: Набирает ответ
    FE->>API: POST /chat/threads/{thread_id}/messages { text }
    API->>DB: Сохранить Message { sender_id=seller }
    API->>WS: Emit "new_message" к buyer_id
    WS-->>B: Ответ продавца в реальном времени

    alt Продавец офлайн
        N-->>S: Push уведомление / Email "Новое сообщение по объявлению [авто]"
        Note over S: Переходит по ссылке → открывает тред
    end

    alt Покупатель не аутентифицирован
        FE->>FE: Показать "Войдите, чтобы написать"
        FE-->>B: Редирект на /login?return=/listings/{id}
    end
```

---

## 6.5 Оплата за публикацию объявления (UC-11)

Сценарий: продавец оплачивает размещение через Click.

```mermaid
sequenceDiagram
    autonumber
    actor S as Продавец
    participant FE as Web Frontend
    participant API as Payment API
    participant GW as Click / Payme (шлюз)
    participant DB as PostgreSQL
    participant N as Notification Service

    Note over S,FE: Фаза 1 — монетизация включена
    S->>FE: Нажимает "Оплатить и опубликовать"
    FE->>API: POST /payments/create { listing_id, amount, gateway: "click" }
    activate API
    API->>DB: Создать Payment { status=PENDING, listing_id, amount }
    API->>GW: POST /order/create { merchant_id, amount, transaction_id, return_url }
    GW-->>API: { payment_url }
    API-->>FE: { payment_url }
    deactivate API
    FE-->>S: Редирект на страницу Click

    S->>GW: Вводит данные карты (PCI DSS scope Click)
    GW->>GW: Проводит транзакцию
    GW->>API: POST /webhooks/click { transaction_id, status: "SUCCESS", sign }
    activate API
    API->>API: Проверить подпись webhook (HMAC)
    API->>DB: Payment.status = SUCCESS
    API->>DB: Listing.status = PUBLISHED
    API->>N: Отправить квитанцию на email
    API-->>GW: 200 OK
    deactivate API
    GW-->>S: Редирект на return_url (страница объявления)
    FE-->>S: "Объявление опубликовано! Квитанция отправлена на email"

    alt Платёж отклонён
        GW->>API: POST /webhooks/click { status: "FAILED", error_code }
        API->>DB: Payment.status = FAILED
        API-->>FE: Уведомление (через polling или WS)
        FE-->>S: "Оплата не прошла. Попробуйте снова или выберите другой способ"
    end

    alt Webhook не получен в течение 5 мин
        Note over API: Scheduler job: polling статуса
        API->>GW: GET /order/status { transaction_id }
        GW-->>API: { status }
        API->>DB: Обновить Payment.status
    end
```

---

## 6.6 Просмотр каталога с Deal Rating (UC-01)

Сценарий: гость открывает каталог, применяет фильтры.

```mermaid
sequenceDiagram
    autonumber
    actor U as Гость
    participant FE as Web Frontend (SSR)
    participant API as Catalog API
    participant Cache as Redis Cache
    participant DB as PostgreSQL
    participant CDN as CDN (фото)

    U->>FE: GET /catalog?make=Toyota&price_max=15000
    FE->>API: GET /api/listings?make=Toyota&price_max=15000&page=1
    activate API
    API->>Cache: GET listings:Toyota:price_max=15000:p1
    Cache-->>API: MISS
    API->>DB: SELECT listings WHERE make='Toyota' AND price <= 15000 AND status='PUBLISHED'
    DB-->>API: [{ id, make, model, year, price, deal_rating, mileage_flag, blurred_thumb_url, ... }]
    API->>Cache: SET listings:Toyota:price_max=15000:p1 TTL=60s
    API-->>FE: JSON listings[]
    deactivate API

    FE-->>U: HTML каталог (SSR, < 2 сек)
    Note over U,CDN: Браузер загружает thumbnails параллельно
    FE->>CDN: GET /photos/{id}/thumb.jpg (для каждой карточки)
    CDN-->>FE: фото (< 500 мс из edge)

    U->>FE: Меняет фильтр (AJAX, без перезагрузки)
    FE->>API: GET /api/listings?make=Toyota&price_max=15000&deal_rating=GREAT_DEAL
    API->>DB: Запрос с новыми фильтрами
    DB-->>API: Отфильтрованный результат
    API-->>FE: JSON
    FE-->>U: Список обновлён (< 2 сек)

    alt Нет результатов
        DB-->>API: []
        API->>DB: Relaxed query (убрать один фильтр)
        DB-->>API: Похожие объявления
        API-->>FE: { results: [], similar: [...] }
        FE-->>U: "Не найдено. Похожие объявления:"
    end
```
