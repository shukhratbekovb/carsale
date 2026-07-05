# Carsale — Процессы и жизненные циклы сущностей

> Версия: 1.0 · Дата: 2026-06-28 · Источник: [PRD](../PRD.md) · Автор: Системный аналитик

---

## 1. Бизнес-процессы (Activity-диаграммы)

### 1.1 Сквозной процесс: Продажа автомобиля на платформе

Полный путь от регистрации продавца до завершения сделки.

```mermaid
flowchart TD
    Start([Продавец решил продать авто])

    subgraph Регистрация["Зона: Регистрация"]
        A[Вводит номер телефона]
        B{OTP верный?}
        C[Аккаунт создан / найден]
    end

    subgraph Размещение["Зона: Размещение объявления"]
        D[Заполняет форму объявления]
        E[Загружает фото]
        F[ML: Авто-блюр госномера]
        G[Продавец подтверждает превью]
        H[ML: Запрос AI-оценки цены]
        I[Видит рекомендованный диапазон]
        J{Корректирует цену?}
        K[Нажимает 'Опубликовать']
    end

    subgraph Проверка["Зона: ML-проверка фрода (async)"]
        L{Фрод-флаг?}
        M[Объявление на модерации]
        N[Администратор проверяет]
        O{Одобрено?}
        P[Объявление отклонено]
        Q[Объявление опубликовано]
    end

    subgraph Продажа["Зона: Взаимодействие с покупателем"]
        R[Покупатель видит Deal Rating в ленте]
        S[Покупатель пишет в чат]
        T[Продавец отвечает]
        U{Договорились?}
        V[Встреча и осмотр]
        W[Сделка завершена]
        X[Продавец снимает объявление]
    end

    Start --> A --> B
    B -->|Нет| A
    B -->|Да| C --> D --> E --> F --> G --> H --> I --> J
    J -->|Да| D
    J -->|Нет| K --> L
    L -->|Да| M --> N --> O
    O -->|Нет| P
    O -->|Да| Q
    L -->|Нет| Q
    Q --> R --> S --> T --> U
    U -->|Нет| S
    U -->|Да| V --> W --> X
```

---

### 1.2 Процесс модерации фрод-флага

Административный процесс проверки помеченных объявлений.

```mermaid
flowchart TD
    Start([ML-сервис: fraud_flag = true])

    subgraph Автоматика["Зона: Автоматика"]
        A[Listing.status = PENDING_MODERATION]
        B[Продавец получает уведомление: объявление на проверке]
        C[Запись в очередь модерации]
    end

    subgraph Модерация["Зона: Администратор"]
        D[Открывает очередь\nмодерации]
        E[Изучает объявление:\nфото, цена, профиль продавца,\nпричина флага]
        F{Решение}
    end

    subgraph Результат["Зона: Результат"]
        G[Одобрить]
        H[Отклонить]
        I[Listing.status = PUBLISHED\nfraud_flag = false]
        J[Listing.status = REJECTED]
        K[Уведомление продавцу:\nОпубликовано]
        L[Уведомление продавцу:\nОтклонено + причина]
    end

    Start --> A --> B --> C --> D --> E --> F
    F -->|Чисто| G --> I --> K
    F -->|Фрод подтверждён| H --> J --> L
```

---

### 1.3 Процесс получения расширенного отчёта (P1)

```mermaid
flowchart TD
    Start([Покупатель нажимает 'Получить отчёт'])

    A[Система показывает стоимость отчёта]
    B[Покупатель оплачивает]
    C{Оплата успешна?}
    D[Показать ошибку оплаты]

    E[Система запрашивает VIN/госномер]

    subgraph External["Зона: Внешние источники (параллельно)"]
        F1[Запрос к API ГУБДД\nДТП и штрафы]
        F2[Запрос к страховым\nстраховые случаи]
        F3[Запрос к ГТК UZ\nпробег на таможне]
    end

    G[Агрегация данных]
    H{Данные получены?}
    I[Генерация отчёта]
    J[Частичный отчёт\nс пометкой 'Данные не найдены']
    K[Показать покупателю]

    Start --> A --> B --> C
    C -->|Нет| D
    C -->|Да| E --> F1 & F2 & F3 --> G --> H
    H -->|Все данные есть| I --> K
    H -->|Часть данных| J --> K
```

---

## 2. Жизненные циклы сущностей (State Machine)

### 2.1 Жизненный цикл Объявления (Listing)

Состояния согласованы с полем `status` в модели данных ([08-data-model.md](08-data-model.md)).

```mermaid
stateDiagram-v2
    [*] --> DRAFT : Продавец начал заполнение формы

    DRAFT --> PENDING_MODERATION : Продавец нажал "Опубликовать"\n[ML fraud check запущен]

    PENDING_MODERATION --> PUBLISHED : ML: нет флагов / Администратор одобрил
    PENDING_MODERATION --> REJECTED : Администратор отклонил

    PUBLISHED --> PENDING_MODERATION : Продавец изменил цену / фото\n[повторная ML-проверка]
    PUBLISHED --> ARCHIVED : Продавец снял объявление
    PUBLISHED --> SOLD : Продавец отметил как проданное (P1)
    PUBLISHED --> EXPIRED : Истёк срок публикации (30 дней)

    REJECTED --> DRAFT : Продавец редактирует и повторно отправляет

    ARCHIVED --> DRAFT : Продавец восстанавливает черновик
    ARCHIVED --> [*]
    SOLD --> [*]
    EXPIRED --> [*]

    note right of PENDING_MODERATION
        ML проверяет:
        - image hashes (дубли)
        - цена vs медиана
        - флаг пробега
    end note

    note right of PUBLISHED
        Deal Rating пересчитывается
        при каждом изменении цены
    end note
```

**Описание переходов:**

| Из | В | Триггер | Условие |
|----|---|---------|---------|
| `[*]` | DRAFT | Продавец открыл форму | Аутентифицирован |
| DRAFT | PENDING_MODERATION | POST /listings/{id}/publish | Обязательные поля заполнены, ≥ 1 фото |
| PENDING_MODERATION | PUBLISHED | ML: нет флагов ИЛИ Admin: одобрил | fraud_flag = false |
| PENDING_MODERATION | REJECTED | Admin: отклонил | fraud_flag = true, подтверждён |
| PUBLISHED | PENDING_MODERATION | PUT /listings/{id} (цена/фото) | Повторная проверка ML |
| PUBLISHED | ARCHIVED | DELETE /listings/{id} | Продавец владелец |
| PUBLISHED | EXPIRED | Cron job (ежедневно) | created_at + 30 дней < now() |
| REJECTED | DRAFT | PUT /listings/{id}/edit | Продавец исправил объявление |

---

### 2.2 Жизненный цикл Пользователя (User)

```mermaid
stateDiagram-v2
    [*] --> UNREGISTERED : Гость посещает сайт

    UNREGISTERED --> PHONE_VERIFIED : SMS OTP подтверждён
    PHONE_VERIFIED --> IDENTITY_VERIFIED : OneID верификация пройдена (P1)

    PHONE_VERIFIED --> SUSPENDED : Нарушение правил платформы
    IDENTITY_VERIFIED --> SUSPENDED : Нарушение правил платформы

    SUSPENDED --> PHONE_VERIFIED : Апелляция принята Администратором
    SUSPENDED --> BANNED : Повторное нарушение / серьёзный фрод

    PHONE_VERIFIED --> DELETED : Пользователь удалил аккаунт
    IDENTITY_VERIFIED --> DELETED : Пользователь удалил аккаунт

    DELETED --> [*]
    BANNED --> [*]
```

---

### 2.3 Жизненный цикл Платежа (Payment)

```mermaid
stateDiagram-v2
    [*] --> PENDING : POST /payments/create

    PENDING --> PROCESSING : Redirect на шлюз (пользователь на странице оплаты)
    PROCESSING --> SUCCESS : Webhook: status=SUCCESS
    PROCESSING --> FAILED : Webhook: status=FAILED / таймаут 30 мин
    PROCESSING --> CANCELLED : Пользователь закрыл страницу / нажал "Отмена"

    SUCCESS --> REFUNDED : Запрос на возврат (P2)
    FAILED --> PENDING : Пользователь повторяет попытку

    SUCCESS --> [*]
    REFUNDED --> [*]
    FAILED --> [*]
    CANCELLED --> [*]

    note right of PROCESSING
        Polling статуса каждые 1 мин,
        если webhook не получен
        в течение 5 мин
    end note
```

---

### 2.4 Жизненный цикл Deal Rating

```mermaid
stateDiagram-v2
    [*] --> PENDING : Объявление создано (черновик)

    PENDING --> COMPUTING : Запрос к ML-сервису отправлен
    COMPUTING --> GREAT_DEAL : цена ≤ медиана × 0.9
    COMPUTING --> FAIR_PRICE : медиана × 0.9 < цена ≤ медиана × 1.1
    COMPUTING --> OVERPRICED : цена > медиана × 1.1
    COMPUTING --> UNAVAILABLE : Недостаточно данных / ML-сервис недоступен

    GREAT_DEAL --> COMPUTING : Продавец изменил цену
    FAIR_PRICE --> COMPUTING : Продавец изменил цену
    OVERPRICED --> COMPUTING : Продавец изменил цену
    UNAVAILABLE --> COMPUTING : Retry через 5 мин / новые данные появились

    note right of UNAVAILABLE
        Объявление публикуется без Deal Rating.
        Retry job попробует через 5 мин.
    end note
```
