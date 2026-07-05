# Carsale — Модель данных

> Версия: 1.0 · Дата: 2026-06-28 · Источник: [PRD](../PRD.md) · Автор: Системный аналитик

---

## 1. ER-диаграмма

Логическая модель данных. Отражает сущности и их связи на уровне бизнес-домена.  
Статусы сущностей согласованы с [07-process-and-state.md](07-process-and-state.md).

```mermaid
erDiagram
    USER ||--o{ LISTING : "размещает"
    USER ||--o{ CHAT_THREAD : "участвует как покупатель"
    USER ||--o{ CHAT_THREAD : "участвует как продавец"
    USER ||--o{ NOTIFICATION : "получает"
    USER ||--o{ SAVED_SEARCH : "сохраняет"
    USER }o--o{ LISTING : "сохраняет в избранное (FAVORITE)"

    LISTING ||--|{ PHOTO : "содержит"
    LISTING ||--|| VEHICLE : "описывает"
    LISTING ||--|| ML_RESULT : "имеет результаты ML"
    LISTING ||--o{ CHAT_THREAD : "порождает"
    LISTING ||--o| PAYMENT : "оплачивается"
    LISTING ||--o| VEHICLE_HISTORY : "имеет отчёт (P1)"

    CHAT_THREAD ||--|{ MESSAGE : "содержит"

    USER {
        uuid id PK
        string phone_hash UK
        string email
        enum role
        enum verification_status
        boolean marketing_consent
        datetime created_at
        datetime updated_at
        datetime deleted_at
    }

    VEHICLE {
        uuid id PK
        uuid listing_id FK UK
        string make
        string model
        int year
        int mileage
        string vin
        string license_plate
        enum condition
        string color
        enum transmission
        enum drive_type
        float engine_volume
        string fuel_type
    }

    LISTING {
        uuid id PK
        uuid seller_id FK
        enum status
        decimal price_uzs
        string description
        string city
        enum deal_rating_label
        float deal_rating_score
        decimal recommended_price_min
        decimal recommended_price_max
        boolean mileage_flag
        string mileage_flag_reason
        boolean fraud_flag
        string fraud_reason
        datetime published_at
        datetime expires_at
        datetime created_at
        datetime updated_at
    }

    PHOTO {
        uuid id PK
        uuid listing_id FK
        string blurred_url
        string original_key
        boolean plate_detected
        int sort_order
        datetime created_at
    }

    ML_RESULT {
        uuid id PK
        uuid listing_id FK UK
        enum deal_rating_label
        float deal_rating_score
        decimal recommended_min
        decimal recommended_max
        boolean mileage_anomaly
        string mileage_anomaly_reason
        boolean fraud_detected
        string fraud_reason
        string image_hash
        datetime computed_at
    }

    CHAT_THREAD {
        uuid id PK
        uuid listing_id FK
        uuid buyer_id FK
        uuid seller_id FK
        datetime last_message_at
        datetime created_at
    }

    MESSAGE {
        uuid id PK
        uuid thread_id FK
        uuid sender_id FK
        string text
        boolean is_read
        datetime sent_at
    }

    PAYMENT {
        uuid id PK
        uuid listing_id FK
        uuid user_id FK
        enum payment_type
        decimal amount_uzs
        string currency
        enum status
        string gateway
        string gateway_transaction_id UK
        datetime created_at
        datetime updated_at
    }

    NOTIFICATION {
        uuid id PK
        uuid user_id FK
        enum type
        string channel
        jsonb payload
        boolean delivered
        datetime created_at
        datetime delivered_at
    }

    SAVED_SEARCH {
        uuid id PK
        uuid user_id FK
        jsonb filters
        boolean alert_enabled
        datetime created_at
    }

    VEHICLE_HISTORY {
        uuid id PK
        uuid listing_id FK
        int accidents_count
        int fines_count
        int customs_mileage
        datetime report_generated_at
        string data_source
    }
```

---

## 2. Словарь сущностей

### USER — Пользователь

| Атрибут | Тип | Обяз. | Описание | Ограничения |
|---------|-----|:-----:|----------|-------------|
| id | UUID | ✅ | Первичный ключ | PK, auto-generated |
| phone_hash | STRING(128) | ✅ | bcrypt/Argon2 хеш номера телефона | UK, NOT NULL; raw телефон не хранится |
| email | STRING(255) | ❌ | Email пользователя | nullable; используется для уведомлений |
| role | ENUM | ✅ | BUYER / SELLER / ADMIN | DEFAULT 'BUYER' |
| verification_status | ENUM | ✅ | UNVERIFIED / PHONE_VERIFIED / IDENTITY_VERIFIED / SUSPENDED / BANNED | DEFAULT 'UNVERIFIED' |
| marketing_consent | BOOLEAN | ✅ | Согласие на маркетинговые рассылки | DEFAULT false |
| created_at | TIMESTAMP | ✅ | Дата регистрации | NOT NULL |
| updated_at | TIMESTAMP | ✅ | Дата последнего обновления | NOT NULL |
| deleted_at | TIMESTAMP | ❌ | Soft delete (ЗРУ-547 — право на удаление) | nullable |

**Индексы:** `phone_hash` (unique), `email` (partial unique, not null), `verification_status`

---

### VEHICLE — Автомобиль

| Атрибут | Тип | Обяз. | Описание | Ограничения |
|---------|-----|:-----:|----------|-------------|
| id | UUID | ✅ | PK | |
| listing_id | UUID | ✅ | FK → LISTING | UK (один авто = одно объявление) |
| make | STRING(64) | ✅ | Марка (Toyota, Chevrolet...) | NOT NULL |
| model | STRING(128) | ✅ | Модель (Camry, Cobalt...) | NOT NULL |
| year | SMALLINT | ✅ | Год выпуска | CHECK: 1950 ≤ year ≤ current_year |
| mileage | INTEGER | ✅ | Пробег в км | CHECK: 0 ≤ mileage ≤ 999999 |
| vin | STRING(17) | ❌ | VIN (хранится внутри, не публикуется) | nullable; CHECK: format |
| license_plate | STRING(16) | ❌ | Госномер (хранится внутри, не публикуется) | nullable |
| condition | ENUM | ✅ | NEW / GOOD / FAIR / POOR | NOT NULL |
| color | STRING(32) | ❌ | Цвет кузова | nullable |
| transmission | ENUM | ✅ | AUTOMATIC / MANUAL / CVT / ROBOT | NOT NULL |
| drive_type | ENUM | ✅ | FWD / RWD / AWD / 4WD | NOT NULL |
| engine_volume | FLOAT | ❌ | Объём двигателя в литрах | nullable; CHECK: 0.5 ≤ x ≤ 10 |
| fuel_type | ENUM | ❌ | PETROL / DIESEL / GAS / ELECTRIC / HYBRID | nullable |

**Примечание:** VIN и license_plate НЕ возвращаются в публичном API; доступны только в admin-интерфейсе и внутренних ML-запросах (BR-3).

---

### LISTING — Объявление

| Атрибут | Тип | Обяз. | Описание | Ограничения |
|---------|-----|:-----:|----------|-------------|
| id | UUID | ✅ | PK | |
| seller_id | UUID | ✅ | FK → USER | NOT NULL |
| status | ENUM | ✅ | DRAFT / PENDING_MODERATION / PUBLISHED / REJECTED / ARCHIVED / SOLD / EXPIRED | DEFAULT 'DRAFT' |
| price_uzs | DECIMAL(14,0) | ✅ | Цена в узбекских сумах | NOT NULL; CHECK: > 0 |
| description | TEXT | ❌ | Описание объявления | nullable; max 5000 chars |
| city | STRING(64) | ✅ | Город продажи | NOT NULL |
| deal_rating_label | ENUM | ❌ | GREAT_DEAL / FAIR_PRICE / OVERPRICED / UNAVAILABLE | nullable до вычисления |
| deal_rating_score | FLOAT | ❌ | Внутренний скор модели [0,1] | nullable |
| recommended_price_min | DECIMAL(14,0) | ❌ | Нижняя граница рекомендации | nullable |
| recommended_price_max | DECIMAL(14,0) | ❌ | Верхняя граница рекомендации | nullable |
| mileage_flag | BOOLEAN | ✅ | Флаг аномального пробега | DEFAULT false |
| mileage_flag_reason | STRING(512) | ❌ | Пояснение к флагу пробега | nullable |
| fraud_flag | BOOLEAN | ✅ | Флаг фрода | DEFAULT false |
| fraud_reason | STRING(512) | ❌ | Причина флага фрода | nullable |
| published_at | TIMESTAMP | ❌ | Дата публикации | nullable |
| expires_at | TIMESTAMP | ❌ | Дата истечения (published_at + 30 дней) | nullable |
| created_at | TIMESTAMP | ✅ | | NOT NULL |
| updated_at | TIMESTAMP | ✅ | | NOT NULL |

**Индексы:** `seller_id`, `status`, `city`, `deal_rating_label`, `(status, city, deal_rating_label)` (составной для фильтрации каталога), `expires_at` (для cron-очистки)

---

### PHOTO — Фото объявления

| Атрибут | Тип | Обяз. | Описание | Ограничения |
|---------|-----|:-----:|----------|-------------|
| id | UUID | ✅ | PK | |
| listing_id | UUID | ✅ | FK → LISTING | NOT NULL |
| blurred_url | STRING(512) | ✅ | URL blurred-версии в CDN | NOT NULL; публичный |
| original_key | STRING(512) | ✅ | Key оригинала в private object storage | NOT NULL; не публикуется |
| plate_detected | BOOLEAN | ✅ | Обнаружен ли номерной знак CV-моделью | DEFAULT false |
| sort_order | SMALLINT | ✅ | Порядок отображения | NOT NULL; CHECK: ≥ 0 |
| created_at | TIMESTAMP | ✅ | | NOT NULL |

**Ограничение:** max 20 фото на объявление (CHECK на уровне приложения и constraint).

---

### ML_RESULT — Результаты ML

| Атрибут | Тип | Обяз. | Описание | Ограничения |
|---------|-----|:-----:|----------|-------------|
| id | UUID | ✅ | PK | |
| listing_id | UUID | ✅ | FK → LISTING | UK |
| deal_rating_label | ENUM | ❌ | GREAT_DEAL / FAIR_PRICE / OVERPRICED / UNAVAILABLE | |
| deal_rating_score | FLOAT | ❌ | Скор модели [0,1] | |
| recommended_min | DECIMAL(14,0) | ❌ | Рекомендованный минимум | |
| recommended_max | DECIMAL(14,0) | ❌ | Рекомендованный максимум | |
| mileage_anomaly | BOOLEAN | ✅ | Флаг аномалии пробега | DEFAULT false |
| mileage_anomaly_reason | STRING(512) | ❌ | Причина | |
| fraud_detected | BOOLEAN | ✅ | Флаг фрода | DEFAULT false |
| fraud_reason | STRING(512) | ❌ | Причина | |
| image_hash | STRING(128) | ❌ | Perceptual hash первого фото | для дедупликации |
| computed_at | TIMESTAMP | ✅ | Дата последнего пересчёта | NOT NULL |

---

### CHAT_THREAD — Чат-тред

| Атрибут | Тип | Обяз. | Описание | Ограничения |
|---------|-----|:-----:|----------|-------------|
| id | UUID | ✅ | PK | |
| listing_id | UUID | ✅ | FK → LISTING | NOT NULL |
| buyer_id | UUID | ✅ | FK → USER | NOT NULL |
| seller_id | UUID | ✅ | FK → USER | NOT NULL |
| last_message_at | TIMESTAMP | ❌ | Для сортировки в inbox | nullable |
| created_at | TIMESTAMP | ✅ | | NOT NULL |

**Уникальность:** `UNIQUE(listing_id, buyer_id)` — один тред на пару «объявление + покупатель».

---

### MESSAGE — Сообщение

| Атрибут | Тип | Обяз. | Описание | Ограничения |
|---------|-----|:-----:|----------|-------------|
| id | UUID | ✅ | PK | |
| thread_id | UUID | ✅ | FK → CHAT_THREAD | NOT NULL |
| sender_id | UUID | ✅ | FK → USER | NOT NULL |
| text | TEXT | ✅ | Текст сообщения | NOT NULL; max 2000 chars |
| is_read | BOOLEAN | ✅ | Прочитано получателем | DEFAULT false |
| sent_at | TIMESTAMP | ✅ | | NOT NULL |

---

### PAYMENT — Платёж

| Атрибут | Тип | Обяз. | Описание | Ограничения |
|---------|-----|:-----:|----------|-------------|
| id | UUID | ✅ | PK | |
| listing_id | UUID | ✅ | FK → LISTING | NOT NULL |
| user_id | UUID | ✅ | FK → USER | NOT NULL |
| payment_type | ENUM | ✅ | LISTING_PUBLICATION / VEHICLE_REPORT | NOT NULL |
| amount_uzs | DECIMAL(14,0) | ✅ | Сумма в UZS | NOT NULL; > 0 |
| status | ENUM | ✅ | PENDING / PROCESSING / SUCCESS / FAILED / CANCELLED / REFUNDED | DEFAULT 'PENDING' |
| gateway | ENUM | ✅ | CLICK / PAYME | NOT NULL |
| gateway_transaction_id | STRING(128) | ❌ | ID транзакции шлюза | UK (когда != null) |
| created_at | TIMESTAMP | ✅ | | NOT NULL |
| updated_at | TIMESTAMP | ✅ | | NOT NULL |

**PCI Note:** Данные карт НЕ хранятся (BR-6). Поле `gateway_transaction_id` — внешний ID от шлюза.

---

## 3. Ключевые связи и ограничения целостности

| Связь | Тип | Каскад | Примечание |
|-------|-----|--------|------------|
| LISTING → USER (seller_id) | N:1 | RESTRICT on DELETE | Нельзя удалить USER с активными объявлениями |
| VEHICLE → LISTING | 1:1 | CASCADE DELETE | Авто удаляется вместе с объявлением |
| PHOTO → LISTING | N:1 | CASCADE DELETE | Фото удаляются вместе с объявлением |
| ML_RESULT → LISTING | 1:1 | CASCADE DELETE | |
| CHAT_THREAD → LISTING | N:1 | SET NULL | История чата сохраняется при удалении объявления |
| MESSAGE → CHAT_THREAD | N:1 | CASCADE DELETE | |
| PAYMENT → LISTING | N:1 | RESTRICT | Нельзя удалить объявление с успешным платежом |
| USER (soft delete) → LISTING | — | Listing.seller_id остаётся; данные продавца анонимизируются | GDPR/ЗРУ-547 right to erasure |

**Дополнительные ограничения:**
- `MAX 20 фото на LISTING` — constraint на уровне приложения
- `UNIQUE(listing_id, buyer_id)` в CHAT_THREAD — один тред на пару
- `gateway_transaction_id UNIQUE` в PAYMENT — идемпотентность webhook
- `VEHICLE.year CHECK 1950 ≤ year ≤ CURRENT_YEAR` — валидация данных

---

## 4. Замечания по объёму и росту данных

| Сущность | Ожидаемый рост | Стратегия |
|----------|---------------|-----------|
| LISTING | ~500 новых в неделю MVP; ~100K за год | Индекс по `(status, city)`; archiving EXPIRED |
| PHOTO | ~8–10 фото на объявление; ~4–5M фото/год | CDN + S3-совместимое хранилище; thumbnail pipeline |
| MESSAGE | ~5–10 сообщений на сделку; 50K–200K/год | Партиционирование по `sent_at` (year-month) |
| ML_RESULT | 1:1 с LISTING | Стабильный рост вместе с объявлениями |
| NOTIFICATION | ~10 уведомлений на пользователя/месяц | Retention policy: удалять прочитанные > 30 дней |
| VEHICLE_HISTORY (P1) | ~10% объявлений запросят отчёт | Кэширование отчётов по VIN (TTL 24 часа) |

**Быстро растущие таблицы:** PHOTO, MESSAGE, NOTIFICATION — кандидаты на партиционирование при росте > 10M строк.
