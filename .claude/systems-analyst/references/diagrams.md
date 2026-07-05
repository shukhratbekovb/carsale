# Рецепты диаграмм (Mermaid + PlantUML)

Готовые рабочие шаблоны. Копируй и адаптируй под продукт. Сохраняй синтаксис точно —
неверный синтаксис не отрендерится.

Правило выбора нотации:
- **Mermaid** — по умолчанию (sequence, ER, state, activity/flowchart, class, gantt, C4).
- **PlantUML** — для **use case диаграмм** (у Mermaid нет нативной нотации) и там, где нужна
  строгая UML-семантика.

Если в окружении есть валидатор/рендер Mermaid (коннектор Mermaid Chart) — прогоняй через него
ключевые диаграммы и исправляй ошибки до сдачи.

---

## 1. Use case диаграмма — PlantUML

У Mermaid нет нативной use case нотации. Используй PlantUML:

````markdown
```plantuml
@startuml
left to right direction
skinparam packageStyle rectangle
actor "Покупатель" as Customer
actor "Администратор" as Admin
actor "Платёжный шлюз" as Payment <<external>>

rectangle "Интернет-магазин" {
  usecase "Оформить заказ" as UC1
  usecase "Оплатить заказ" as UC2
  usecase "Проверить оплату" as UC3
  usecase "Управлять каталогом" as UC4
}

Customer --> UC1
Customer --> UC2
Admin --> UC4
UC2 ..> UC3 : <<include>>
UC2 --> Payment
@enduml
```
````

Связи: `-->` association, `..> : <<include>>`, `..> : <<extend>>`, `<|--` generalization.
`<<external>>` помечай внешних актёров-системы.

Если пользователю строго нужен Mermaid и use case можно показать упрощённо — допустим flowchart
с актёрами слева и овалами-юзкейсами, но честно отметь, что это аппроксимация, а не UML use case.

---

## 2. Sequence-диаграмма — Mermaid

````markdown
```mermaid
sequenceDiagram
    autonumber
    actor C as Покупатель
    participant FE as Frontend
    participant API as Order API
    participant DB as База данных
    participant PG as Платёжный шлюз

    C->>FE: Нажимает «Оплатить»
    FE->>API: POST /orders/{id}/pay
    activate API
    API->>DB: Проверить статус заказа
    DB-->>API: Заказ валиден
    API->>PG: Списать средства
    PG-->>API: Успех (txn_id)
    API->>DB: Сохранить оплату
    API-->>FE: 200 OK
    deactivate API
    FE-->>C: Подтверждение оплаты

    alt Платёж отклонён
        PG-->>API: Отказ
        API-->>FE: 402 Payment Required
        FE-->>C: Сообщение об ошибке
    end
```
````

Стрелки: `->>` синхронный вызов, `-->>` ответ, `-)` асинхронный. Блоки: `alt/else/end`,
`opt/end`, `loop/end`, `par/and/end`. `Note over A,B: текст` для пояснений. `activate/deactivate`
показывают время жизни вызова.

---

## 3. ER-диаграмма — Mermaid

````markdown
```mermaid
erDiagram
    CUSTOMER ||--o{ ORDER : "размещает"
    ORDER ||--|{ ORDER_ITEM : "содержит"
    PRODUCT ||--o{ ORDER_ITEM : "входит в"
    ORDER ||--o| PAYMENT : "оплачивается"

    CUSTOMER {
        uuid id PK
        string email UK
        string name
        datetime created_at
    }
    ORDER {
        uuid id PK
        uuid customer_id FK
        string status
        decimal total
        datetime created_at
    }
    ORDER_ITEM {
        uuid id PK
        uuid order_id FK
        uuid product_id FK
        int quantity
        decimal price
    }
    PRODUCT {
        uuid id PK
        string name
        decimal price
        int stock
    }
    PAYMENT {
        uuid id PK
        uuid order_id FK
        string txn_id
        string status
    }
```
````

Кардинальность: `||` ровно один, `o|` ноль или один, `}o` ноль или много, `}|` один или много.
Слева направо читается «<левая> <отношение> <правая>». PK/FK/UK помечают ключи.

---

## 4. State-диаграмма (жизненный цикл) — Mermaid

````markdown
```mermaid
stateDiagram-v2
    [*] --> Создан
    Создан --> Оплачен : оплата подтверждена
    Создан --> Отменён : отмена / таймаут
    Оплачен --> Собран : сборка завершена
    Собран --> Отправлен : передан в доставку
    Отправлен --> Доставлен : получен покупателем
    Доставлен --> [*]
    Отменён --> [*]
    Оплачен --> Возврат : запрос возврата
    Возврат --> [*]
```
````

`[*]` — начальное/конечное состояние. Переход: `Состояние1 --> Состояние2 : событие`.
Состояния должны совпадать со статусами сущности в модели данных (08).

---

## 5. Activity / бизнес-процесс — Mermaid flowchart

````markdown
```mermaid
flowchart TD
    Start([Начало]) --> A[Покупатель оформляет заказ]
    A --> B{Товар в наличии?}
    B -->|Да| C[Зарезервировать товар]
    B -->|Нет| D[Показать «нет в наличии»]
    C --> E[Перейти к оплате]
    E --> F{Оплата прошла?}
    F -->|Да| G[Подтвердить заказ]
    F -->|Нет| H[Освободить резерв]
    G --> End([Конец])
    D --> End
    H --> End
```
````

Для процессов с зонами ответственности используй `subgraph` как дорожки (swimlanes):

````markdown
```mermaid
flowchart TD
    subgraph Покупатель
        A[Оформляет заказ]
    end
    subgraph Система
        B[Резервирует товар]
        C[Создаёт счёт]
    end
    subgraph Склад
        D[Комплектует заказ]
    end
    A --> B --> C --> D
```
````

---

## 6. Class / доменная модель — Mermaid

````markdown
```mermaid
classDiagram
    class Customer {
        +UUID id
        +String email
        +String name
        +placeOrder()
    }
    class Order {
        +UUID id
        +OrderStatus status
        +Money total
        +addItem()
    }
    class OrderItem {
        +int quantity
        +Money price
    }
    Customer "1" --> "0..*" Order : размещает
    Order "1" *-- "1..*" OrderItem : содержит
```
````

Связи: `-->` ассоциация, `*--` композиция, `o--` агрегация, `<|--` наследование,
`..>` зависимость. Кратность — в кавычках по краям.

---

## 7. Архитектура C4 — Mermaid (по умолчанию) или PlantUML (для строгого C4)

**C4 Context (Level 1) — Mermaid:**

````markdown
```mermaid
C4Context
    title Контекст системы — Интернет-магазин
    Person(customer, "Покупатель", "Покупает товары")
    System(shop, "Интернет-магазин", "Каталог, заказы, оплата")
    System_Ext(payment, "Платёжный шлюз", "Обработка платежей")
    System_Ext(email, "Email-сервис", "Уведомления")
    Rel(customer, shop, "Оформляет заказы", "HTTPS")
    Rel(shop, payment, "Проводит платежи", "REST")
    Rel(shop, email, "Шлёт письма", "SMTP")
```
````

**C4 Container (Level 2) — Mermaid:**

````markdown
```mermaid
C4Container
    title Контейнеры — Интернет-магазин
    Person(customer, "Покупатель")
    Container_Boundary(c1, "Интернет-магазин") {
        Container(spa, "Web SPA", "React", "UI в браузере")
        Container(api, "Order API", "Node.js", "Бизнес-логика заказов")
        ContainerDb(db, "База данных", "PostgreSQL", "Заказы, товары")
        Container(queue, "Очередь", "RabbitMQ", "Асинхронные события")
    }
    System_Ext(payment, "Платёжный шлюз")
    Rel(customer, spa, "Использует", "HTTPS")
    Rel(spa, api, "Вызывает", "JSON/HTTPS")
    Rel(api, db, "Читает/пишет", "SQL")
    Rel(api, queue, "Публикует события", "AMQP")
    Rel(api, payment, "Проводит платежи", "REST")
```
````

> Примечание: C4-диаграммы в Mermaid помечены как экспериментальные и иногда капризны с раскладкой.
> Если рендер ломается или нужна строгая C4-нотация — используй PlantUML с библиотекой C4-PlantUML.

**C4 Container — PlantUML (строгий вариант):**

````markdown
```plantuml
@startuml
!include https://raw.githubusercontent.com/plantuml-stdlib/C4-PlantUML/master/C4_Container.puml
Person(customer, "Покупатель")
System_Boundary(c1, "Интернет-магазин") {
  Container(spa, "Web SPA", "React")
  Container(api, "Order API", "Node.js")
  ContainerDb(db, "БД", "PostgreSQL")
}
System_Ext(payment, "Платёжный шлюз")
Rel(customer, spa, "Использует", "HTTPS")
Rel(spa, api, "Вызывает", "JSON/HTTPS")
Rel(api, db, "Читает/пишет", "SQL")
Rel(api, payment, "Платежи", "REST")
@enduml
```
````

---

## 8. Диаграмма Ганта (план поставки) — Mermaid

````markdown
```mermaid
gantt
    title План поставки
    dateFormat YYYY-MM-DD
    axisFormat %m.%y
    section MVP
    Анализ и дизайн      :a1, 2025-01-01, 14d
    Бэкенд заказов       :a2, after a1, 21d
    Фронтенд             :a3, after a1, 21d
    section Расширение
    Интеграция оплаты    :b1, after a2, 14d
    Тестирование         :b2, after b1, 10d
```
````

Подчеркни, что Гант иллюстративный — оценки грубые, не обязательство по датам.

---

## Чек-лист перед сдачей диаграмм

- [ ] Тип нотации выбран по правилу (use case → PlantUML; остальное → Mermaid).
- [ ] Имена актёров/сущностей/сервисов согласованы со всеми остальными документами.
- [ ] Каждая диаграмма снабжена текстовым пояснением.
- [ ] Синтаксис проверен (по возможности — прогоном через рендер/валидатор).
- [ ] Sequence покрывает и happy path, и ошибки; state согласован с моделью данных.
