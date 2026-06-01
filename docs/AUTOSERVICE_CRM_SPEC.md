# AUTOSERVICE_CRM_SPEC — спецификация CRM для автосервиса (1 файл)

> Этот документ — самодостаточная спецификация, по которой можно **собрать CRM под автосервис с нуля**.  
> Формат: продукт → UX → модель данных → бизнес‑правила → API/роуты → структура проекта → тест‑план → этапы разработки.

---

## 0) Цели, принципы, анти‑цели

### Цели (MVP)
- Вести **клиентов** и **автомобили**.
- Вести **заказы (заказ‑наряды)**: работы + товары/запчасти, статусы, сумма, скидка, налог (задел), оплаты, долг.
- Поддержать **несколько платежей** по заказу + возвраты.
- Поддержать **заработок мастеров**: основной режим — **процент**, дополнительно **фикс/почасовая** (как режим начислений владельца).
- Дать базовые **отчёты**: выручка (gross/net), скидки, налоги (если включены), оплаты (cash‑in), дебиторка, начисления, выплаты.
- RBAC: **owner / admin / master**.

### Принципы
- **Один домен: автосервис**. Не использовать сущности “бронирования/ресурсы” (bookings/services/extras) из паркового наследия.
- **Фиксация расчётов**: ключевые числа (итоги, скидка в ₽, налог в ₽, заработок мастера в ₽) должны **фиксироваться** в заказе/строках, чтобы изменение правил не пересчитывало историю.
- **Параметризованные SQL‑запросы**, никакой конкатенации.
- **Нормализация телефона/номера** для поиска и уникальности.

### Анти‑цели (не делаем в MVP)
- Полный склад (остатки, партии, закупки).
- Интеграции (SMS/WhatsApp/1C/онлайн‑касса).
- Мульти‑филиал (несколько сервисов/юрлиц). Сервис 1, доступ owner “из дома” решается деплоем/HTTPS.

---

## 1) Роли и доступы (RBAC)

### Роли
- `owner`: полный доступ, управление матрицей доступов, финансы/отчёты, ставки и правила ЗП.
- `admin`: операционка (клиенты/авто/заказы/каталог), ограниченный доступ к финансам (опционально).
- `master`: просмотр назначенных работ/заказов, смена статусов работ, личная статистика (по желанию).

### Минимальные разрешения (permissions)
Рекомендуемый набор (можно расширять):
- `dashboard:view`
- `clients:view`, `clients:mutate`
- `cars:view`, `cars:mutate`
- `orders:view`, `orders:mutate`
- `catalog:view`, `catalog:manage`
- `payments:view`, `payments:mutate`
- `payroll:view`, `payroll:mutate`
- `admin:users`, `admin:access`, `admin:settings`, `admin:logs`, `admin:reports`

### Дефолтная матрица
- `owner`: всё.
- `admin`: `dashboard:view`, `clients:*`, `cars:*`, `orders:*`, `catalog:*`, `payments:view`, (опционально `payments:mutate`).
- `master`: `dashboard:view`, `orders:view` (ограниченно: только где назначен), (опционально `orders:mutate` только для смены статуса “своих” работ), `payroll:view` (только своё).

---

## 2) Карта экранов (UX)

### 2.1 Авторизация
- Экран `/login`: логин/пароль.
- `/logout`: выход.

### 2.2 Дашборд
Верхние карточки (для owner; для admin можно часть):
- Заказы сегодня: scheduled / in_progress / ready / completed.
- Выручка по заказам за день: **gross / discounts / net**.
- Оплачено за день (cash‑in по платежам).
- Дебиторка по активным заказам.

Блок “быстрые действия”:
- Новый заказ
- Новый клиент
- Новое авто (или в мастере “клиент+авто вместе”)

### 2.3 Клиенты
Список:
- поиск по телефону/ФИО
- быстрый переход в карточку

Карточка клиента:
- контакты + заметки
- список автомобилей клиента
- история заказов

Форма клиента:
- ФИО (обяз.), телефон (обяз.), email (опц.), заметки

### 2.4 Автомобили
Список:
- поиск по VIN/номеру/телефону/марке

Карточка авто:
- данные авто (VIN, номер, марка/модель, год, пробег)
- привязанный клиент
- история заказов
- напоминания (ТО/масло/и т.п.)

Форма авто:
- клиент (выбор/создание), VIN (опц.), номер (опц.), марка/модель, год, цвет, пробег, заметки

### 2.5 Заказы (заказ‑наряд) — ядро
Список заказов:
- фильтры: дата/диапазон, статус, поиск
- колонки: #, дата, авто/номер, клиент/телефон, статус, total, paid, due

Карточка заказа:
- **Шапка**: авто+клиент, статус, комментарий, скидка, налог (если включён)
- **Вкладка “Работы”**: строки работ (каталог, мастер, qty/часы, цена, сумма, статус)
- **Вкладка “Товары”**: строки товаров (каталог/вручную, qty, цена, сумма)
- **Вкладка “Оплаты”**: операции оплаты/возврата, сумма оплачено/долг
- **Итоги**: subtotal (works+products), скидка (в ₽), налог (в ₽), total, paid, due

Статусы заказа:
- `scheduled` (запись создана)
- `in_progress` (в работе)
- `ready` (готово)
- `completed` (закрыт)
- `cancelled` (отменён)

Статусы работ (строк типа work):
- `pending` → `in_progress` → `done` (опционально `cancelled`)

### 2.6 Каталог
Раздел “Каталог” содержит позиции:
- `work` (работы/услуги)
- `product` (товары/запчасти/расходники)

UI:
- список по категориям + поиск
- создание/редактирование: тип, категория, название, цена по умолчанию, единица, активность, сортировка

### 2.7 Финансы (owner)
Экран “Финансы” за период:
- cash‑in: сумма `payments` по дате операции
- net revenue: сумма `orders.total_price` по дате заказа (или по закрытию — выбрать и зафиксировать)
- discounts total: сумма скидок (в ₽)
- taxes total: сумма налогов (если включено)
- дебиторка: сумма `due` по заказам
- расходы/выплаты (если ведём)

### 2.8 Зарплата (owner)
За период:
- начислено по работам (процент/фикс/почасовая)
- начислено по сменам (если используете табель)
- выплаты
- к выплате

---

## 3) Бизнес‑правила расчётов (скидки/налоги/оплаты/итоги)

### 3.1 Денежные правила
- Денежные поля хранить как DECIMAL/NUMERIC (Postgres) и REAL/DECIMAL в SQLite, но **округлять до 2 знаков** на уровне приложения.
- В UI разрешать ввод с запятой, нормализовать `,` → `.`.

### 3.2 Скидки: amount + percent + scope
Требование: поддержать **и % и сумму**, и учитывать в отчётах.

В заказе поддержать:
- `discount_type`: `none | amount | percent`
- `discount_value`: число (₽ или %)
- `discount_scope`: `order_total | works_only | products_only`
- `discount_amount`: **всегда рассчитанная скидка в ₽** (фиксируется)

Правило расчёта:
- `subtotal_works` = сумма строк work (до скидки/налога)
- `subtotal_products` = сумма строк product (до скидки/налога)
- `discount_base`:
  - `order_total` → `subtotal_works + subtotal_products`
  - `works_only` → `subtotal_works`
  - `products_only` → `subtotal_products`
- `discount_amount`:
  - если `amount`: `min(discount_value, discount_base)` (не больше базы)
  - если `percent`: `round2(discount_base * (discount_value/100))`, ограничить 0..100
- `subtotal_before_tax` = `(subtotal_works + subtotal_products) - discount_amount`

В отчётах:
- `gross_revenue` = сумма `(subtotal_works + subtotal_products)`
- `discounts_total` = сумма `discount_amount`
- `net_revenue` = `gross_revenue - discounts_total`

### 3.3 Налоги (НДС/налоги) — задел на будущее
Сейчас по умолчанию выключено, но схема должна позволять включить позже.

Настройки (в `settings`):
- `tax_enabled` (0/1)
- `tax_mode`: `vat | sales_tax` (на будущее)
- `tax_rate`: число, например 20
- `prices_include_tax`: 0/1

Хранение в заказе (snapshot на момент заказа):
- `tax_enabled`, `tax_mode`, `tax_rate`, `prices_include_tax`
- `tax_amount` (в ₽, computed и фиксируется)

Правило расчёта (если `tax_enabled=1`):
- если `prices_include_tax=0` (цены без налога):
  - `tax_amount = round2(subtotal_before_tax * tax_rate/100)`
  - `total_price = subtotal_before_tax + tax_amount`
- если `prices_include_tax=1`:
  - `total_price = subtotal_before_tax`
  - `tax_amount = round2(total_price * tax_rate/(100+tax_rate))`

### 3.4 Оплаты/возвраты и долг
Таблица платежей допускает несколько операций.

Определения:
- `paid_amount = sum(kind='payment') - sum(kind='refund')`
- `due_amount = max(0, total_price - paid_amount)`

Инварианты (MVP):
- запрещаем переплату: `paid_amount + new_payment <= total_price + 0.005`

### 3.5 Пересчёт итогов
Любая мутация:
- изменение `order_lines`
- изменение скидки
- изменение налоговых настроек заказа

Должна вызвать пересчёт кэшей в `orders`:
- `subtotal_works`, `subtotal_products`
- `discount_amount`
- `subtotal_before_tax`
- `tax_amount`
- `total_price`

---

## 4) Заработок мастеров (процент/фикс/почасовая) + переопределение по услуге

Требование:
- процент может отличаться **по каждой услуге**
- владелец может выставлять режим: **percent | fixed | hourly**
- основной режим: **percent**

### 4.1 Модель “правил” (рекомендуется)
1) Правило по умолчанию для мастера:
- `master_comp_rules`: `user_id`, `mode`, `value`, `effective_from`, `is_active`

2) Переопределение мастер×услуга:
- `master_comp_overrides`: `user_id`, `catalog_item_id`, `mode`, `value`

3) Фиксация в строке заказа (work‑line):
- `master_comp_mode`, `master_comp_value`, `master_earned_amount`

### 4.2 Расчёт earned по строке work
- если override существует → используем override
- иначе → правило мастера по умолчанию (активное на дату)
- иначе → 0

Формулы:
- `percent`: `earned = round2(line_total * value/100)`
- `fixed`: `earned = round2(value)`
- `hourly`: `earned = round2((labor_minutes/60) * value)` (если labor_minutes пустой, можно использовать quantity как часы — но нужно выбрать один стандарт)

### 4.3 Когда фиксировать earned
Рекомендация:
- фиксировать при `orders.status = completed` (пересчитать все work‑строки и записать earned в строках)
- не пересчитывать для уже закрытого заказа

---

## 5) Нормализация данных (телефон/номер/поиск)

### 5.1 Телефон
Хранить:
- `phone_raw`
- `phone_normalized`

Нормализация (простая RU):
- убрать всё кроме цифр
- если длина 11 и начинается с `8` → заменить на `7...`
- если длина 10 → добавить `7` впереди

Поиск:
- по `phone_normalized LIKE '%digits%'`

### 5.2 Номер авто
Хранить:
- `license_plate_raw`
- `license_plate_normalized` = upper + убрать пробелы/дефисы

---

## 6) Модель данных (рекомендуемая схема)

> Это “чистая автосервисная схема”. Она не зависит от парковых таблиц.

### 6.1 Пользователи и доступы

#### `users`
- id PK
- username unique
- password_hash (scrypt/bcrypt/argon2 — не sha256)
- name
- role (`owner|admin|master`)
- is_active
- created_at, updated_at

#### `role_permissions`
- role (`owner|admin|master`)
- permission (код)
- allowed (0/1)
- PK (role, permission)

### 6.2 Клиенты и авто

#### `clients`
- id PK
- full_name (обяз.)
- phone_raw, phone_normalized (обяз.)
- email (опц.)
- notes (опц.)
- created_at, updated_at

#### `cars`
- id PK
- client_id (FK clients) обязательный
- make, model, vin
- license_plate_raw, license_plate_normalized
- year, color, mileage
- notes
- created_at, updated_at

#### `car_reminders`
- id PK
- car_id FK cars
- title, due_date, notes
- is_done
- created_at

### 6.3 Каталог (1 таблица с type)

#### `catalog_items`
- id PK
- type (`work|product`)
- category
- name
- default_price
- unit
- is_active
- sort_order
- created_at, updated_at

### 6.4 Заказы и строки

#### `orders`
Базовое:
- id PK
- car_id FK cars
- opened_at, closed_at
- status
- notes
- created_by
- created_at, updated_at

Скидка (snapshot + computed):
- discount_type, discount_value, discount_scope, discount_amount

Налог (snapshot + computed):
- tax_enabled, tax_mode, tax_rate, prices_include_tax, tax_amount

Кэши итогов:
- subtotal_works
- subtotal_products
- subtotal_before_tax
- total_price

#### `order_lines`
- id PK
- order_id FK orders
- line_type (`work|product`)
- catalog_item_id (nullable)
- name (snapshot)
- quantity
- unit_price
- total
- notes

Для work:
- master_id (nullable)
- work_status (`pending|in_progress|done|cancelled`)
- labor_minutes (nullable)
- master_comp_mode, master_comp_value, master_earned_amount

### 6.5 Оплаты

#### `payments`
- id PK
- order_id FK orders
- paid_at
- amount
- method
- kind (`payment|refund`)
- note
- created_by

### 6.6 Зарплата

#### `master_comp_rules`
- user_id, mode, value, effective_from, is_active

#### `master_comp_overrides`
- user_id, catalog_item_id, mode, value

#### `payouts`
- user_id, paid_at, amount, method, note, created_by

---

## 7) DDL‑черновик (PostgreSQL)

```sql
-- users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(200) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner','admin','master')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- role_permissions (матрица)
CREATE TABLE IF NOT EXISTS role_permissions (
  role VARCHAR(20) NOT NULL,
  permission VARCHAR(64) NOT NULL,
  allowed INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (role, permission)
);

-- clients
CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(200) NOT NULL,
  phone_raw VARCHAR(50) NOT NULL,
  phone_normalized VARCHAR(32) NOT NULL,
  email VARCHAR(200),
  notes TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_clients_phone_norm ON clients(phone_normalized);

-- cars
CREATE TABLE IF NOT EXISTS cars (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  make VARCHAR(100),
  model VARCHAR(100),
  vin VARCHAR(64),
  license_plate_raw VARCHAR(50),
  license_plate_normalized VARCHAR(32),
  year INTEGER,
  color VARCHAR(50),
  mileage INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cars_plate_norm ON cars(license_plate_normalized);
CREATE INDEX IF NOT EXISTS idx_cars_vin ON cars(vin);

-- reminders
CREATE TABLE IF NOT EXISTS car_reminders (
  id SERIAL PRIMARY KEY,
  car_id INTEGER NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  due_date DATE,
  notes TEXT,
  is_done INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- catalog
CREATE TABLE IF NOT EXISTS catalog_items (
  id SERIAL PRIMARY KEY,
  type VARCHAR(20) NOT NULL CHECK (type IN ('work','product')),
  category VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  default_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit VARCHAR(50) NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_catalog_type_cat ON catalog_items(type, category);

-- orders
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  car_id INTEGER NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  opened_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP WITHOUT TIME ZONE,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
  notes TEXT,

  discount_type VARCHAR(20) NOT NULL DEFAULT 'none',
  discount_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_scope VARCHAR(20) NOT NULL DEFAULT 'order_total',
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,

  tax_enabled INTEGER NOT NULL DEFAULT 0,
  tax_mode VARCHAR(20),
  tax_rate NUMERIC(6,2) NOT NULL DEFAULT 0,
  prices_include_tax INTEGER NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,

  subtotal_works NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal_products NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal_before_tax NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_price NUMERIC(12,2) NOT NULL DEFAULT 0,

  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_opened_at ON orders(opened_at);

-- order_lines
CREATE TABLE IF NOT EXISTS order_lines (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  line_type VARCHAR(20) NOT NULL CHECK (line_type IN ('work','product')),
  catalog_item_id INTEGER REFERENCES catalog_items(id) ON DELETE SET NULL,
  name VARCHAR(200) NOT NULL,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,

  master_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  work_status VARCHAR(20),
  labor_minutes INTEGER,
  master_comp_mode VARCHAR(20),
  master_comp_value NUMERIC(12,2),
  master_earned_amount NUMERIC(12,2),

  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_order_lines_order ON order_lines(order_id);
CREATE INDEX IF NOT EXISTS idx_order_lines_master ON order_lines(master_id);

-- payments
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  paid_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  method VARCHAR(20) NOT NULL DEFAULT 'other',
  kind VARCHAR(20) NOT NULL DEFAULT 'payment',
  note TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_payments_order_paid_at ON payments(order_id, paid_at);

-- compensation rules
CREATE TABLE IF NOT EXISTS master_comp_rules (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('percent','fixed','hourly')),
  value NUMERIC(12,2) NOT NULL DEFAULT 0,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS master_comp_overrides (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  catalog_item_id INTEGER NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('percent','fixed','hourly')),
  value NUMERIC(12,2) NOT NULL DEFAULT 0,
  UNIQUE (user_id, catalog_item_id)
);

-- payouts
CREATE TABLE IF NOT EXISTS payouts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  paid_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  method VARCHAR(20) NOT NULL DEFAULT 'other',
  note TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_payouts_user_paid_at ON payouts(user_id, paid_at);
```

---

## 8) API/роуты (Express + EJS)

> Роуты можно сделать HTML (EJS) + JSON (для модалок), как в текущем репо.

### Auth
- `GET /login`
- `POST /login`
- `POST /logout`

### Dashboard
- `GET /`

### Clients
- `GET /clients?search=`
- `GET /clients/new`
- `POST /clients`
- `GET /clients/:id`
- `GET /clients/:id/edit`
- `PUT /clients/:id`
- `DELETE /clients/:id`

### Cars
- `GET /cars?search=`
- `GET /cars/new`
- `POST /cars`
- `GET /cars/:id`
- `GET /cars/:id/edit`
- `PUT /cars/:id`
- `DELETE /cars/:id`
- `POST /cars/:id/reminders`
- `POST /cars/reminders/:rid/toggle`
- `DELETE /cars/reminders/:rid`

### Catalog
- `GET /catalog?type=&category=&search=`
- `GET /catalog/new`
- `POST /catalog`
- `GET /catalog/:id/edit`
- `PUT /catalog/:id`
- `POST /catalog/:id/toggle`
- `DELETE /catalog/:id`

### Orders
- `GET /orders?date=&status=&search=`
- `GET /orders/new`
- `POST /orders`
- `GET /orders/:id`
- `GET /orders/:id/edit`
- `PUT /orders/:id`
- `POST /orders/:id/status`

Строки:
- `POST /orders/:id/lines` (line_type work/product)
- `PUT /orders/lines/:lineId`
- `DELETE /orders/lines/:lineId`

Оплаты:
- `POST /orders/:id/payments`
- (опционально) `DELETE /orders/:id/payments/:pid`

### Payroll
- `GET /admin/payroll?start_date=&end_date=&user_id=`
- `POST /admin/payroll/rules` (управление правилами)
- `POST /admin/payouts`

### Reports/Finance
- `GET /admin/finance?start_date=&end_date=`
- `GET /admin/reports?start_date=&end_date=`
- `GET /admin/finance/export?type=...`

---

## 9) Структура проекта (рекомендация)

```
server.js
config/
  database.js         # init + runQuery/runExec + migrations
  permissions.js      # список perms/labels + default матрица
controllers/
  authController.js
  clientController.js
  carController.js
  catalogController.js
  orderController.js
  financeController.js
  payrollController.js
  accessController.js
  settingsController.js
routes/
  auth.js
  dashboard.js
  clients.js
  cars.js
  catalog.js
  orders.js
  admin-finance.js
  admin-payroll.js
  admin-access.js
middleware/
  auth.js            # session + requirePermission
  csrf.js            # CSRF
  logger.js          # activity logs (без утечек)
views/
public/
tests/
docs/
```

Принцип: роуты тонкие; вся логика и пересчёты в контроллерах.

---

## 10) Тест‑план (node:test + supertest)

Команда: `npm test`.

### Smoke
- `GET /login` 200
- `GET /` без сессии → 302 `/login`
- логин owner/admin/master

### Orders
- create order → add work line → totals recalculated
- add discount percent (works_only) → discount_amount computed
- add tax (prices_include_tax=0) → tax_amount computed
- add payment → due уменьшился

### RBAC
- master не может удалить заказ
- admin может создать/редактировать заказ
- owner видит finance/reports

### Payroll
- override master percent by service влияет на earned только при закрытии заказа
- изменение правил после закрытия заказа не меняет earned

---

## 11) Этапы разработки (порядок реализации)

### Этап 1: База + auth + RBAC
- подключение БД (SQLite dev, Postgres prod)
- сессии, логин, матрица доступов

### Этап 2: Клиенты/Авто
- CRUD + нормализация + поиск

### Этап 3: Каталог
- CRUD + использование в строках заказа

### Этап 4: Заказы
- CRUD, строки work/product, пересчёт totals, скидка, налог (feature), статусы

### Этап 5: Оплаты и финансы
- payments, due/paid, отчёт cash‑in, дебиторка

### Этап 6: Зарплата
- правила, overrides, фиксация earned, выплаты, отчёт “к выплате”

### Этап 7: Отчёты
- gross/net/discounts/taxes, top services, динамика по дням

---

## 12) Деплой и “owner из дома”

Требование: филиал 1, но owner должен заходить из дома.

Минимум:
- публичный домен + HTTPS
- в prod обязательно `SESSION_SECRET` (длинный)
- Postgres для прод (сессии и данные), чтобы не зависеть от файла SQLite на одном ПК
- базовая защита логина: rate limit + логирование попыток (без пароля)

---

## 13) Уточнения для реализации (чтобы не было разночтений)

### 13.1 Стандарт для `hourly` (почасовая работа)
Чтобы расчёты и UI были однозначны, фиксируем правило:
- Источник времени: **только `labor_minutes`** (целое число минут) в `order_lines` для строк `line_type='work'`.
- Если режим начисления `hourly`, то `labor_minutes` **обязателен** (валидация на сервере).
- В UI допускаем ввод часов/минут, но сохраняем в минутам (`labor_minutes`).

Формула:
- `earned = round2((labor_minutes / 60) * hourly_rate)`

### 13.2 База дат для финансовых отчётов (что считаем “выручкой за период”)
В документе упомянуты варианты “по дате заказа” или “по закрытию”. Фиксируем 3 разных показателя, чтобы не путать операционку и деньги:
- **cash_in**: сумма `payments` по `paid_at`.
- **orders_net_by_closed_at**: сумма `orders.total_price` по `closed_at` (только `status='completed'`) — основной показатель “выручка по завершённым работам”.
- **orders_net_by_opened_at**: сумма `orders.total_price` по `opened_at` (для операционной аналитики, опционально).

Рекомендация для MVP:
- В “Финансы” показывать **по умолчанию** `orders_net_by_closed_at` и `cash_in` рядом (они могут различаться при дебиторке).

### 13.3 Методы оплаты (enum + расширяемость)
Поле `payments.method` (строка) нормализуем в ограниченный список для отчётности:
- `cash`, `card`, `transfer`, `other`

Дополнительно:
- `payments.note` — произвольная строка (например “СБП”, “Тинькофф”, “касса №1”).

### 13.4 Таблица `settings` (минимум для MVP)
В тексте есть ссылка на `settings`, но DDL не описан. Добавляем таблицу:
- `settings`: `key` (PK), `value` (TEXT), `updated_at`

Минимальные ключи (MVP):
- `tax_enabled` = `0|1`
- `tax_mode` = `vat|sales_tax` (пока можно хранить `vat`)
- `tax_rate` = число
- `prices_include_tax` = `0|1`

Важно:
- При создании заказа — делать **snapshot** налоговых настроек в `orders.*` (как описано в 3.3), чтобы история не менялась.

### 13.5 “Печатная форма” заказ-наряда (MVP)
Чтобы можно было распечатать/сохранить в PDF:
- `GET /orders/:id/print` — упрощённая EJS-страница без лишней навигации.
- Должна содержать: шапку (клиент/телефон, авто/VIN/номер, даты), список работ/товаров, скидку, налог (если включён), итоги, оплачено/долг, подписи.

### 13.6 Activity logs (без утечек)
Если ведём журнал действий (рекомендация), то:
- Запрещено логировать: пароли, `SESSION_SECRET`, сырые токены, персональные данные сверх необходимого.
- Для событий: `user_id`, `action`, `entity_type`, `entity_id`, `meta` (JSON/TEXT), `created_at`.

### 13.7 Seed/первичный owner
Для запуска “с нуля” нужен способ создать первого `owner`:
- Скрипт/CLI `npm run seed:owner` (или миграция с дефолтным пользователем, но лучше скриптом).
- Ввод: `username`, `password`, `name`.
- В prod запускать один раз (и удалить/ограничить доступ к скрипту на уровне окружения).

---

## 14) Нефункциональные требования для MVP

### 14.1 Валидация и ограничения данных (сервер — источник истины)
Все внешние вводы (query/body) валидируются и нормализуются до записи в БД.

Рекомендуемые лимиты (можно скорректировать под реалии сервиса):
- `clients.full_name`: 1..200
- `clients.phone_raw`: 5..50, `phone_normalized`: 10..11 цифр после нормализации (RU)
- `clients.email`: 0..200
- `cars.make/model`: 0..100
- `cars.vin`: 0..64 (uppercase, без пробелов)
- `cars.license_plate_raw`: 0..50, `license_plate_normalized`: 0..32
- `catalog_items.name`: 1..200, `category`: 1..50
- `orders.notes`, `order_lines.notes`, `payments.note`: 0..2000
- деньги (`unit_price`, `total_price`, `amount`, `discount_value`): \(>= 0\), 2 знака после запятой
- `discount_percent`: 0..100
- `quantity`: \(> 0\) (для работ допускаем 1 по умолчанию)
- `labor_minutes`: \(> 0\) если требуется (см. 13.1)

### 14.2 Поведение при ошибках
- Для HTML-роутов: показывать понятную EJS-страницу ошибки (без stacktrace) и сохранять введённые данные, где возможно.
- Для JSON-ответов (если используются): единый формат ошибок, например `{ error: { code, message } }`, корректные HTTP-статусы.

### 14.3 Производительность и масштаб (MVP)
- Базовый таргет: списки (clients/cars/orders/catalog) должны открываться < 1–2 сек при 10–50k строках на Postgres при наличии индексов из раздела 6–7.
- Пагинация: для списков использовать `limit/offset` (или keyset, если появится потребность), по умолчанию 50 строк/страница.
- Поиск: использовать индексы по нормализованным полям; не делать полнотекст в MVP.

### 14.4 Безопасность (минимальный набор)
- Сессии: `SESSION_SECRET` обязателен в prod; cookie с `httpOnly`, `secure` (под HTTPS), `sameSite` (по умолчанию `lax`).
- CSRF: включён для всех форм мутаций.
- Rate limit: на `POST /login` и (если есть) на любые JSON-mutate endpoints.
- Пароли: хэширование `bcrypt/argon2/scrypt`, политика минимальной длины пароля (например 8+).
- Логи: не писать пароли/секреты/сырые токены/полные cookies.

### 14.5 Наблюдаемость и аудит (MVP)
- Логи приложения: уровни `info/warn/error`, корреляция запросов (request id) по возможности.
- Activity log (если включён): минимально фиксировать “кто/что/когда” по мутациям критичных сущностей (`orders`, `payments`, `catalog`, `clients`).

### 14.6 Резервное копирование и восстановление
Так как в prod рекомендован Postgres:
- Ежедневный backup (pg_dump) + хранение минимум 7–14 дней.
- Проверка восстановления раз в месяц (на отдельной БД/стенде).

Если временно используется SQLite:
- Резервная копия файла по расписанию, с остановкой записи/или копирование через механизм бэкапа SQLite, чтобы избежать повреждений.

### 14.7 Конфигурация окружения (env)
Минимальный набор переменных:
- `NODE_ENV`
- `PORT`
- `DATABASE_URL` (prod Postgres)
- `SESSION_SECRET`
- (опционально) `APP_BASE_URL` (для корректных редиректов/ссылок в печатной форме)

### 14.8 Совместимость браузеров и доступность
- Поддержка современных Chromium-браузеров.
- Минимально: корректные label для форм, фокус-стили, клавиатурная навигация в основных формах (login, order edit).

