# REPORT — Белка Парк CRM (технический отчёт)

> Документ описывает текущее состояние кода. Принимаемые в правках расширения и фиксы помечаются явно (см. `coordination/HANDOFF.md`).

## 1. Назначение системы

CRM для парка отдыха «Белка Парк». Покрывает:

- Учёт клиентов.
- Управление ресурсами (беседки / квесты) и допами (уголь, мангал, проектор и т.п.).
- Создание и ведение бронирований с проверкой конфликтов по времени.
- Дашборд-сетка занятости на день.
- Бонусные баллы по номеру телефона + промо «N часов в подарок».
- Панель руководителя (`/admin`, услуги, доп. услуги): пользователи, настройки, аналитика/отчёты, журнал действий.

## 2. Стек и зависимости

- Node.js >= 16 (тестировалось на v22).
- Express 4 (`express`, `express-session`, `method-override`).
- EJS 3 — серверный рендеринг.
- **Без `DATABASE_URL`:** `sql.js` 1.x — SQLite в WebAssembly. Файл базы — `data/forest-park.db` (или `DB_PATH`). На каждый mutation вызывается `saveDB()` (`fs.writeFileSync`) — см. [config/database.js](../config/database.js).
- **С непустым `DATABASE_URL`:** пул `pg`; SQL из контроллеров проходит через [config/sqlDialect.js](../config/sqlDialect.js) (`?` → `$n`, функции дат под PostgreSQL). `saveDB()` — no-op; `getDB()` недоступен — только `runQuery` / `runExec` / `runOne` / `runScalar` / `runInsertReturning`. Если в схеме `public` ещё нет таблицы **`users`** (пустая БД вроде Railway без init), при старте один раз применяется [scripts/postgres/init.sql](../scripts/postgres/init.sql) (`CREATE IF NOT EXISTS`, сиды с `ON CONFLICT` / `WHERE NOT EXISTS`).
- Хеширование паролей — `crypto.createHash('sha256')` (без соли). См. ограничения в [docs/SECURITY.md](SECURITY.md).
- На фронте: vanilla JS + Chart.js (CDN) — для графиков аналитики (см. [views/partials/header.ejs](../views/partials/header.ejs)).

`devDependencies`:

- `supertest` — HTTP-тесты Express-приложения.

## 3. Запуск

### 3.1 Локально

```powershell
npm install
node server.js
```

Откройте http://localhost:3000. Креды по умолчанию (создаются при первом старте):

- `owner` / `owner123` — **владелец**: полный доступ, в том числе пользователи, настройки, журнал, матрица доступов, модуль ЗП/финансов, финансовые KPI на дашборде.
- `admin` / `admin123` — **администратор парка**: операции парка (клиенты, брони, услуги, допы, учёт времени, аналитика, быстрые модалки), **без** системного администрирования и без чувствительных финансовых KPI на главной.

База создаётся в `data/forest-park.db`. Если файла нет — создаётся пустой. Если есть — загружается, выполняются in-place миграции схемы (см. п.5).

Файл `Запуск.bat` в корне — обёртка, которая стартует `node server.js`.

### 3.2 Docker

```powershell
docker compose up -d --build
```

- Контейнер **`forest-park-crm`**: образ собирается из [`Dockerfile`](../Dockerfile) (`package.json` + **`package-lock.json`**, `npm ci --omit=dev`). Внутри процесс слушает **`PORT`** из окружения, иначе **3000** (Railway задаёт `PORT` сама).
- Том **`db-data`** → `/app/data` (резерв под файл SQLite, если запускать приложение **без** `DATABASE_URL`).
- Контейнер **`postgres`** (PostgreSQL 16), том **`pg-data`**: при **первом** создании тома entrypoint выполняет [scripts/postgres/init.sql](../scripts/postgres/init.sql). Сервис **`forest-park-crm`** в compose получает **`DATABASE_URL`** на этот Postgres; если БД пустая (например, без mount init), схему при первом подключении догоняет тот же `init.sql` из [config/database.js](../config/database.js).
- Шаблон переменных: [.env.example](../.env.example).

См. также [Dockerfile](../Dockerfile), [docker-compose.yml](../docker-compose.yml). Эксплуатация и деплой: [docs/RUNBOOK.md](RUNBOOK.md), пример TLS: [deploy/Caddyfile.example](../deploy/Caddyfile.example).

### 3.3 Тесты

Хард-гейт проекта:

```powershell
npm test
```

Запускает `node --test "tests/**/*.test.js"`. См. [docs/TEST_PLAN.md](TEST_PLAN.md).

## 4. Структура проекта

```
forest-park-crm/
├── server.js                — точка входа, монтаж middleware/роутов, экспорт {app, initDB}
├── config/
│   ├── database.js          — initDB + миграции (sqlite) / проверка `SELECT 1` (pg) + async API runQuery/…
│   └── sqlDialect.js        — адаптация SQLite-ориентированного SQL под PostgreSQL
├── middleware/
│   ├── auth.js              — sessionMiddleware, requireAuth, requireRole
│   └── logger.js            — logAction(entityType) → пишет в activity_logs
├── controllers/
│   ├── analyticsController.js
│   ├── bonusController.js
│   ├── bookingController.js
│   ├── clientController.js
│   ├── extraController.js
│   ├── financeController.js
│   ├── logController.js
│   ├── serviceController.js
│   ├── settingsController.js
│   └── userController.js
├── routes/
│   ├── auth.js              — /login GET/POST, /logout POST
│   ├── dashboard.js         — GET /, GET /dashboard/grid (json)
│   ├── clients.js           — CRUD клиентов + /search
│   ├── services.js          — CRUD услуг (только admin)
│   ├── extras.js            — CRUD допов (только admin)
│   ├── bookings.js          — CRUD броней + JSON API
│   ├── admin-users.js
│   ├── admin-settings.js
│   ├── admin-reports.js     — аналитика + CSV-экспорт
│   ├── admin-finance.js     — финансы (оплаты/расходы/смены/выплаты) + CSV-экспорт
│   └── admin-logs.js        — журнал действий
├── views/                   — EJS-шаблоны (см. docs/DESIGN.md)
├── public/
│   ├── css/style.css        — единый стилевой файл
│   └── js/main.js           — глобальный поиск + хелперы
├── data/forest-park.db      — SQLite-файл (через sql.js)
├── scripts/postgres/      — init.sql (схема); seed-test-data-dbeaver.sql (тестовые клиенты/брони для DBeaver)
├── seed.js                  — отдельный скрипт сидинга демо-данных
├── tests/                   — Node-тесты (node:test + supertest)
├── deploy/                  — пример Caddyfile для TLS
└── docs/                    — REPORT, DESIGN, RUNBOOK, VPS_PROJECT, POSTGRES_MIGRATION, PRODUCT_ROADMAP, …
```

## 5. Схема БД (SQLite)

Все таблицы создаются и мигрируются при `initDB()` в [config/database.js](../config/database.js).

### 5.1 `clients`

| Поле | Тип | Заметки |
| --- | --- | --- |
| id | INTEGER PK AUTOINCREMENT | |
| full_name | VARCHAR(200) NOT NULL | ФИО |
| phone | VARCHAR(20) NOT NULL | Свободный формат |
| email | VARCHAR(100) | |
| birthday | DATE | |
| notes | TEXT | |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | |
| updated_at | DATETIME DEFAULT CURRENT_TIMESTAMP | |

### 5.2 `services`

| Поле | Тип | Заметки |
| --- | --- | --- |
| id | INTEGER PK AUTOINCREMENT | |
| name | VARCHAR(100) NOT NULL | |
| category | VARCHAR(50) NOT NULL | `gazebos` / `quests` (значение `lasertag` может встречаться в старых строках `booking_items`) |
| description | TEXT | |
| capacity | INTEGER | вместимость |
| price_per_hour | DECIMAL(10,2) | цена за час |
| price_fixed | DECIMAL(10,2) | фиксированная |
| price_per_person | DECIMAL(10,2) | за человека (миграция) |
| is_active | BOOLEAN DEFAULT 1 | |
| image | VARCHAR(200) | |
| prepayment_mode | VARCHAR(20) DEFAULT `default` | при `payment_status=partial` в UI всегда правило `min(1000 ₽, итог)`; устаревшее `half_of_total` при миграции сбрасывается в `default` |

### 5.3 `extras`

| Поле | Тип | Заметки |
| --- | --- | --- |
| id | INTEGER PK AUTOINCREMENT | |
| name | VARCHAR(100) NOT NULL | |
| price | DECIMAL(10,2) NOT NULL | |
| unit | VARCHAR(20) DEFAULT 'шт' | `шт` / `компл` |
| is_active | BOOLEAN DEFAULT 1 | |

### 5.4 `bookings`

| Поле | Тип | Заметки |
| --- | --- | --- |
| id | INTEGER PK AUTOINCREMENT | |
| client_id | INTEGER NOT NULL | FK clients ON DELETE CASCADE |
| booking_date | DATE NOT NULL | |
| start_time | TIME NOT NULL | |
| duration_minutes | INTEGER DEFAULT 120 | (мигрировано из `duration_hours`) |
| total_price | DECIMAL(10,2) DEFAULT 0 | пересчитывается на create/update |
| people_count | INTEGER DEFAULT 1 | |
| status | VARCHAR(20) DEFAULT 'pending' | `pending` / `confirmed` / `completed` / `cancelled` |
| payment_status | VARCHAR(20) DEFAULT 'unpaid' | `unpaid` / `partial` / `paid` |
| prepayment_amount | DECIMAL(10,2) DEFAULT 0 | при `partial` — ровно `min(1000, total_price)` (после акций/бонусов); валидация на сервере |
| notes | TEXT | |
| bonus_spent | INTEGER DEFAULT 0 | списано бонусов |
| bonus_earned | INTEGER DEFAULT 0 | начислено бонусов при создании |
| cancelled_at | DATETIME / TIMESTAMP | время отмены; заполняется при первой отмене через `POST /bookings/:id/cancel` |
| cancel_prepay_outcome | VARCHAR(20) | при отмене: `retained` (удержано) / `refunded` (возврат) / `na` (не применимо); у старых отмен может быть `NULL` |
| cancellation_note | TEXT | комментарий при отмене (опционально) |
| created_at | DATETIME DEFAULT CURRENT_TIMESTAMP | |

### 5.5 `booking_items`

Позиции внутри одной брони (бронь содержит несколько услуг и/или допов).

| Поле | Тип | Заметки |
| --- | --- | --- |
| id | INTEGER PK AUTOINCREMENT | |
| booking_id | INTEGER NOT NULL | FK bookings ON DELETE CASCADE |
| item_type | VARCHAR(20) NOT NULL | `service` или `extra` |
| item_id | INTEGER NOT NULL | id из `services`/`extras` |
| name | VARCHAR(100) NOT NULL | snapshot имени |
| quantity | INTEGER DEFAULT 1 | |
| duration_minutes | INTEGER DEFAULT 0 | (мигрировано из `duration_hours`) |
| price | DECIMAL(10,2) NOT NULL | snapshot цены |
| total | DECIMAL(10,2) NOT NULL | `price * quantity` |
| notes | TEXT | |
| start_time | TIME | время старта позиции (миграция) |
| end_time | TIME | время окончания позиции (миграция) |
| item_category | VARCHAR(50) | категория для аналитики (миграция) |

### 5.6 `users`

| Поле | Тип | Заметки |
| --- | --- | --- |
| id | INTEGER PK AUTOINCREMENT | |
| username | VARCHAR(50) UNIQUE NOT NULL | |
| password_hash | VARCHAR(200) NOT NULL | SHA-256 без соли |
| name | VARCHAR(100) NOT NULL | ФИО / отображение |
| role | VARCHAR(20) NOT NULL DEFAULT 'admin' | `owner` / `admin` / `instructor` / `cleaner` (роль `manager` мигрирует в `admin`) |
| is_active | BOOLEAN DEFAULT 1 | |
| created_at, updated_at | DATETIME | |

### 5.7 `settings`

`key` (PK) + `value` + `type` (`string`/`number`/`boolean`) + `label` + `description`.

Дефолты, проставляются при первом старте:

| key | default | назначение |
| --- | --- | --- |
| `park_name` | `Белка Парк` | имя парка |
| `work_start` / `work_end` | `09:00` / `23:00` | рабочее окно |
| `time_slot_minutes` | `60` | стандартный слот |
| `booking_max_days` | `90` | глубина броней вперёд |
| `booking_cancel_hours` | `24` | за сколько можно отменить |
| `currency` | `₽` | |
| `phone_format` | `+7 (___) ___-__-__` | маска ввода |
| `bonus_enabled` | `1` | бонусная система вкл/выкл |
| `bonus_percent` | `5` | % начисления от суммы |
| `bonus_rate` | `1` | 1 балл = N ₽ |
| `promo_enabled` | `1` | акция «час в подарок» |
| `promo_hours_threshold` | `4` | порог для акции |
| `promo_free_hours` | `1` | сколько часов в подарок |

### 5.8 `bonus_points`

| Поле | Тип |
| --- | --- |
| id | PK |
| phone | VARCHAR(20) UNIQUE |
| points | INTEGER |
| total_earned | INTEGER |
| total_spent | INTEGER |
| updated_at | DATETIME |

Связь — по нормализованному номеру (`phone.replace(/[^0-9+]/g, '')`).

### 5.9 `bonus_ledger`

Журнал операций по бонусам. Нужен для аудита: кто/когда/почему начислил/списал, и с какой бронью это связано.

| Поле | Тип | Заметки |
| --- | --- | --- |
| id | PK | |
| client_id | INTEGER | FK clients, `ON DELETE SET NULL` |
| phone | VARCHAR(20) | нормализованный телефон |
| delta_points | INTEGER | signed: `+` начисление, `-` списание |
| reason | VARCHAR(20) | `earn` / `spend` / `adjust` |
| booking_id | INTEGER | FK bookings, `ON DELETE SET NULL` |
| user_id | INTEGER | FK users, `ON DELETE SET NULL` |
| note | TEXT | комментарий |
| created_at | DATETIME | |

Списания и начисления при создании бронирования пишутся и в `bonus_points` (агрегат), и в `bonus_ledger` (история).\n

### 5.10 `activity_logs`

| Поле | Тип |
| --- | --- |
| id | PK |
| user_id, user_name | INTEGER, VARCHAR(100) |
| action | VARCHAR(50) NOT NULL — `create`/`update`/`delete`/`GET` |
| entity_type | VARCHAR(30) — например `user`, `settings` |
| entity_id | INTEGER |
| details | TEXT (срез `req.body`) |
| ip_address | VARCHAR(45) |
| created_at | DATETIME |

> Внимание: `details` пишет `JSON.stringify(req.body).substring(0, 500)`. Не подключайте `logAction` к `/login` без редактирования (см. [docs/SECURITY.md](SECURITY.md), BUG-004 в [docs/QA_REPORT.md](QA_REPORT.md)).

### 5.11 `booking_payments`

Платежи по бронированиям (кассовый метод), включая возвраты.

| Поле | Тип | Заметки |
| --- | --- | --- |
| id | PK | |
| booking_id | INTEGER | FK bookings, `ON DELETE CASCADE` |
| paid_at | DATETIME | дата/время операции |
| amount | DECIMAL(10,2) | |
| method | VARCHAR(20) | `cash|card|transfer|online|other` |
| kind | VARCHAR(10) | `payment|refund` |
| note | TEXT | |
| created_by | INTEGER | FK users, `ON DELETE SET NULL` |

Агрегаты по брони:

- \(paid\_amount = \sum payment - \sum refund\)
- \(due\_amount = bookings.total\_price - paid\_amount\)
- \(payment\_status\) синхронизируется в `bookings.payment_status` при добавлении операции (см. `controllers/financeController.js`)

### 5.12 `expenses`

Журнал расходов (кассовый метод).

| Поле | Тип |
| --- | --- |
| id | PK |
| spent_at | DATETIME |
| amount | DECIMAL(10,2) |
| category | VARCHAR(50) |
| vendor | VARCHAR(200) |
| note | TEXT |
| payment_method | VARCHAR(20) |
| linked_booking_id | INTEGER (nullable) |
| created_by | INTEGER (nullable) |

### 5.13 `staff_shifts`

Смены/начисления (для P&L).

| Поле | Тип |
| --- | --- |
| id | PK |
| user_id | INTEGER |
| shift_date | DATE |
| role_on_shift | VARCHAR(30) |
| hours | DECIMAL(10,2) |
| rate_type | VARCHAR(10) |
| rate_value | DECIMAL(10,2) |
| note | TEXT |
| created_at | DATETIME |

### 5.14 `payouts`

Выплаты сотрудникам (кассовый метод).

| Поле | Тип |
| --- | --- |
| id | PK |
| user_id | INTEGER |
| paid_at | DATETIME |
| amount | DECIMAL(10,2) |
| method | VARCHAR(20) |
| note | TEXT |
| created_by | INTEGER (nullable) |

### 5.15 Миграции

`initDB()` идемпотентна: каждая миграция обёрнута в `try/catch` и читает `PRAGMA table_info(...)`:

1. `booking_items.start_time`, `booking_items.item_category` — добавляются если отсутствуют.
2. `booking_items.end_time` — то же.
3. `services.price_per_person` — то же.
4. `bookings.duration_hours → duration_minutes` (rename + перенос данных через `bookings_old`).
5. Старая схема с `bookings.service_id` → переезд услуг в `booking_items`.
6. `bookings.bonus_spent`, `bookings.bonus_earned` — добавляются.
7. `bookings.prepayment_amount` — добавляется (предоплата при статусе оплаты `partial`).
8. `bookings.cancelled_at`, `bookings.cancel_prepay_outcome`, `bookings.cancellation_note` — учёт отмены и исхода предоплаты (ручной выбор при отмене).
7. Сидинг по умолчанию: 13 услуг, 12 допов, 2 пользователя (`owner`, `admin`), 14 настроек.

Дополнительный сценарий ручного сидинга — `node seed.js` (создаёт демо-клиентов и брони на ближайшие даты).

## 6. Маршруты HTTP

Все маршруты, кроме `/login`, требуют сессию (`requireAuth`). Доступ к разделам задаётся **`requirePermission(...)`** и feature-флагами ([server.js](../server.js)); отдельно **`requireRole('admin', 'owner')`** используется только для **`POST /admin/demo-preview`**.

Роли в матрице: **`owner`**, **`admin`**, **`instructor`**, **`cleaner`** ([config/permissions.js](../config/permissions.js)). У **`owner`** по умолчанию полный набор прав; у **`admin`** — набор «администратор парка» (без `admin:users`, `admin:settings`, `admin:logs`, `admin:access`, `admin:salary`); у линейного персонала — `me:shifts`, `dashboard:view`, `bookings:view`. Роль **`manager`** удалена из модели: при миграции пользователи переводятся в **`admin`**, строки `role_permissions` для `manager` удаляются. При старте БД идемпотентно заполняются строки матрицы для перечисленных ролей.

При включённой настройке `demo_mode_enabled` у пользователя с ролью **`admin`** или **`owner`** в сессии может быть задан `demoPreviewRole`; тогда для UI и RBAC дашборда/броней используется **эффективная роль** (`res.locals.effectiveRole`, [utils/demoPreview.js](../utils/demoPreview.js)); серверные гейты по правам смотрят на **реальную** роль и матрицу.

> Простое описание каждой страницы и матрица «кто что видит/может» — в [PAGES.md](PAGES.md). Этот раздел — технический инвентори по `routes/*`.

### 6.0 Сводка ролевых гейтов

| URL-префикс | Гейт(ы) | Файл регистрации |
| --- | --- | --- |
| `/login`, `/logout` | публично | [server.js](../server.js) (`app.use('/', authRoutes)`) |
| `/`, `/dashboard/grid` | `requireAuth` | [server.js](../server.js) |
| `/clients` (список), `/clients/search` | `requireAuth` + `canAccessClientList` / `canSearchClients` ([utils/rbac.js](../utils/rbac.js)) | [routes/clients.js](../routes/clients.js) |
| `/clients/new`, `POST /clients`, `GET /clients/:id` | `requireAuth` + права `clients:*` (по умолчанию `owner`, `admin`) | [routes/clients.js](../routes/clients.js) |
| `/clients/:id/edit`, `PUT /clients/:id`, `DELETE /clients/:id` | `requireAuth` + `canEditClient` (по умолчанию `owner`, `admin`) | [routes/clients.js](../routes/clients.js) |
| `/bookings/*` (просмотр) | `requireAuth` | [server.js](../server.js) |
| `/bookings/new`, `POST /bookings`, `PUT /bookings/:id`, `PATCH /bookings/:id/status`, `POST /bookings/:id/complete`, `DELETE /bookings/:id`, `GET /bookings/api/catalog` | `requireAuth` + внутрироутный `canMutateBookings(role)` ([utils/rbac.js](../utils/rbac.js)) | [routes/bookings.js](../routes/bookings.js) |
| `/services/*` | `requireAuth` + `requirePermission('services:manage')` + feature | [server.js](../server.js) |
| `/extras/*` | `requireAuth` + `requirePermission('extras:manage')` + feature | [server.js](../server.js) |
| `/admin/users/*` | `requireAuth` + `requirePermission('admin:users')` | [server.js](../server.js) |
| `/admin/settings/*` | `requireAuth` + `requirePermission('admin:settings')` | [server.js](../server.js) |
| `/admin/reports/*` | `requireAuth` + `requirePermission('admin:reports')` + feature | [server.js](../server.js) |
| `/admin/finance/*` | `requireAuth` + `requirePermission('admin:salary')` + feature | [server.js](../server.js) |
| `/admin/demo-preview` | `requireAuth` + `requireRole('admin', 'owner')` + `demo_mode_enabled` внутри роута | [server.js](../server.js), [routes/admin-demo-preview.js](../routes/admin-demo-preview.js) |
| `/quick/*` | `requireAuth` + `requirePermission('bookings:mutate')` | [server.js](../server.js) |
| `POST /quick/expenses`, `POST /quick/shifts` | `requireAuth` + `logAction('expense'\|'shift')` | [routes/quick.js](../routes/quick.js) |
| `DELETE /quick/expenses/:id`, `DELETE /quick/shifts/:id` | `requireAuth` + `bookings:mutate` + `canDeleteOwnQuickRecord` (`owner` — любая запись; иначе только своя и ≤1 час) | [routes/quick.js](../routes/quick.js) |
| `/admin/logs/*` | `requireAuth` + `requirePermission('admin:logs')` | [server.js](../server.js) |
| `/admin` (без подпути) | `requireAuth` + `requirePermission('admin:reports')` → редирект на `/admin/reports` | [server.js](../server.js) |

`canMutateBookings` возвращает `true` для **`owner`** и **`admin`** (линейный персонал — только просмотр). Серверные 403 в [routes/bookings.js](../routes/bookings.js) сработают при отсутствии права `bookings:mutate` или если `canMutateBookings` ложно.

### 6.1 Авторизация — [routes/auth.js](../routes/auth.js)

| Метод | Путь | Назначение |
| --- | --- | --- |
| GET | `/login` | Форма входа |
| POST | `/login` | Проверка кредов, заведение `req.session.user` |
| POST | `/logout` | Уничтожение сессии, редирект на `/login` |

### 6.2 Дашборд — [routes/dashboard.js](../routes/dashboard.js)

| Метод | Путь | Назначение |
| --- | --- | --- |
| GET | `/` | Сетка ресурсов × часов на дату (`?date=YYYY-MM-DD`), KPI, календарь месяца. Финансовые агрегаты («Всего клиентов», «Выручка за день», суммы ₽ в календаре) — **только** при `canViewDashboardFinanceKPIs` → роль **`owner`**. У **`admin`** и линейного персонала эти KPI скрыты. Сетка для **`instructor`** фильтруется по категории `quests` ([utils/rbac.js](../utils/rbac.js)). |
| GET | `/dashboard/grid` | JSON-версия сетки (для AJAX-обновления) |

### 6.3 Клиенты — [routes/clients.js](../routes/clients.js)

| Метод | Путь | Доступ | Примечание |
| --- | --- | --- | --- |
| GET | `/clients` | роли с `clients:view` (по умолчанию `owner`, `admin`) | поиск через `?search=`; гейт `canAccessClientList` |
| GET | `/clients/search` | роли с `clients:view` | AJAX, JSON; гейт `canSearchClients` |
| GET | `/clients/new` | `owner`, `admin` (при правах) | форма; локаль шаблона **`clientRecord`**, не `client` (EJS/Express) |
| POST | `/clients` | `owner`, `admin` (при правах) | создание (редирект на карточку); при `Accept: application/json` — `201 { id }`, ошибки `400/500` с `{ error }` (модалка «Новая запись») |
| GET | `/clients/:id` | `owner`, `admin` (при правах) | карточка из брони (контакты + история, чтобы можно было связаться) |
| GET | `/clients/:id/edit` | роли с `clients:mutate` (`canEditClient`) | форма |
| PUT | `/clients/:id` | роли с `clients:mutate` | обновление (через `_method=PUT`) |
| DELETE | `/clients/:id` | роли с `clients:mutate` | удаление (через `_method=DELETE`) |
| GET | `/me/shifts` и др. | `me:shifts` (префикс `/me` без гейта по `feature_timesheets_enabled`) | личный кабинет смен; чувствительные блоки ЗП — по флагам/правам в шаблоне |
| GET | `/admin/timesheets`, `/admin/salary`, `/admin/access` | см. `role_permissions` + feature-флаги | учёт времени, ЗП по сменам, матрица доступов |

### 6.4 Услуги — [routes/services.js](../routes/services.js) (admin)

GET `/services`, GET `/services/new`, POST `/services`, GET `/services/:id/edit`, PUT `/services/:id`, DELETE `/services/:id`, POST `/services/:id/toggle` (вкл/выкл).

### 6.5 Допы — [routes/extras.js](../routes/extras.js) (admin)

GET `/extras`, POST `/extras`, PUT `/extras/:id`, DELETE `/extras/:id`.

### 6.6 Бронирования — [routes/bookings.js](../routes/bookings.js)

| Метод | Путь | Назначение |
| --- | --- | --- |
| GET | `/bookings` | список + фильтры `status`, `date_from`, `date_to`, `search` |
| GET | `/bookings/new` | форма (поддерживает `?date=&resource_id=&start_hour=`) |
| POST | `/bookings` | создание (тело — `items_json`; при `payment_status=partial` — `prepayment_amount` строго по правилам предоплаты, см. `services.prepayment_mode`; при ненулевой предоплате создаётся строка в `booking_payments` с комментарием «Предоплата при оформлении», чтобы касса/финансы видели ту же сумму) |
| GET | `/bookings/:id` | детали |
| GET | `/bookings/:id/edit` | форма редактирования |
| PUT | `/bookings/:id` | обновление (то же по `prepayment_amount` при `partial`) |
| PATCH | `/bookings/:id/status` | смена статуса (**не** для `cancelled` — редирект на карточку; отмена только через `POST /cancel`) |
| POST | `/bookings/:id/cancel` | отмена брони (`pending` / `confirmed` → `cancelled`): тело `cancel_prepay_outcome` (`retained` \| `refunded` \| `na`), опц. `cancellation_note` (до 500 симв.); выставляются `cancelled_at`, поля исхода предоплаты |
| POST | `/bookings/:id/complete` | завершение **подтверждённой** брони (`status=confirmed` → `completed`): если «к доплате» > 0 — тело формы `final_payment_amount`, `payment_method` (`cash`/`card`/`transfer`/`online`/`other`), опц. `payment_note`; создаётся проводка через `financeController.addBookingPayment` (учёт в `/admin/finance/payments` и сводке). Если долга нет — только смена статуса |
| DELETE | `/bookings/:id` | удаление |
| GET | `/bookings/calendar` | JSON-сетка на дату |

JSON-эндпоинты:

| Путь | Возвращает |
| --- | --- |
| `GET /bookings/api/services-by-client?client_id=` | клиент + его брони |
| `GET /bookings/api/items/:id` | позиции брони |
| `GET /bookings/api/bonus/:clientId` | баланс бонусов клиента |
| `GET /bookings/api/promo` | актуальные настройки промо |

### 6.7 Админка

- [routes/admin-users.js](../routes/admin-users.js): GET `/admin/users`, GET `/admin/users/new`, POST `/admin/users`, GET `/admin/users/:id/edit`, PUT `/admin/users/:id`, DELETE `/admin/users/:id` (JSON-ответ). Пишет в `activity_logs` через `logAction('user')`.
- [routes/admin-settings.js](../routes/admin-settings.js): GET `/admin/settings`, POST `/admin/settings` (массовое сохранение; в т.ч. `demo_mode_enabled`).
- [routes/admin-demo-preview.js](../routes/admin-demo-preview.js): POST `/admin/demo-preview` — смена `session.demoPreviewRole` для предпросмотра UI (только если в настройках включён `demo_mode_enabled`); редирект на `Referer` или `/`. Монтируется в [server.js](../server.js) до редиректа `GET /admin` → `/admin/reports`.
- [routes/admin-reports.js](../routes/admin-reports.js): GET `/admin/reports`, GET `/admin/reports/export?format=csv&type=bookings|clients|finance&start_date=&end_date=`, GET `/admin/reports/api/data` (JSON для AJAX-фильтров). **Период:** `period=7|30|90|…` (число дней до сегодня, до 366) или `period=custom` + `start_date` + `end_date` (ISO `YYYY-MM-DD`). Пресет в query имеет приоритет над полями дат. Ответ API включает `range: { startDate, endDate }`, `bookingHourDist` (24 слота по часу начала брони), в `overview` — дополнительно `cancelledRetainedCount` и `cancelledRetainedPaidSum` (отмены с `cancel_prepay_outcome=retained`, фильтр по `cancelled_at` и категориям как у остальных KPI), плюс прежние блоки. Страница аналитики: Chart.js — комбо по дням/месяцам (подписи дат/месяцев в `ru-RU`), кольцевые (категории, статусы), горизонтальные столбцы (оплата, топ услуг), **вертикальные столбцы по часам начала**; данные для инициализации — `*Json` с экранированием `<` для `<script>`.
- [routes/admin-finance.js](../routes/admin-finance.js): `/admin/finance` — дашборд: **KPI по броням** в выбранном периоде (`booking_date`, без `cancelled`): выручка (сумма `total_price`), «Оплачено» (полностью оплаченные), «Частично (внесено)» (сумма оплат при неполном закрытии), «Не оплачено» (остаток); **ЗП (ожидаемо)** = начисления по `staff_shifts` в интервале; **Чистыми** = (оплачено полностью + внесено по частичным) − ЗП (ожидаемо); число броней; **подтв. часы** = сумма `duration_minutes` / 60 для `status IN ('confirmed','completed')`. Таблица **«Выручка по дням»** (группировка по дате брони). Блок **«ЗП (детализация)»**: по сотрудникам из смен; подпись сотрудника — `role_on_shift` из смены, иначе роль учётки (`owner`/`admin`/др.). Ниже — **касса по дате проводки** (как раньше: cash-in/out, прибыль, дебиторка), отмены с удержанием, разбивка по способам. Query `start_date` / `end_date` (ISO). CSV `type=overview`: дополнительно `expected_payroll_total`, `net_after_payroll_estimate`, `booking_revenue_total`, `booking_paid_full`, `booking_partial_paid`, `booking_unpaid_balance`, `bookings_count_active`, `confirmed_hours_total`, плюс прежние поля. Экспорт `type=cancelled_retained` — строки отмен с удержанием. Подстраницы: `/admin/finance/payments`, `/admin/finance/payments/:bookingId`, `/admin/finance/expenses`, `/admin/finance/shifts`, `/admin/finance/payouts`.
- [routes/admin-logs.js](../routes/admin-logs.js): GET `/admin/logs` (с пагинацией и фильтрами `action`, `entity_type`, `user_id`, `date_from`, `date_to`), POST `/admin/logs/clear` (`?days=N`).

`/admin` без подпути → редирект на `/admin/reports`.

### 6.8 Быстрые действия — [routes/quick.js](../routes/quick.js)

Подключён в [server.js](../server.js) под `requireAuth` + `requirePermission('bookings:mutate')`.

| Метод | Путь | Доступ | Назначение |
| --- | --- | --- | --- |
| GET | `/quick/users` | `bookings:mutate` (по умолчанию `owner`, `admin`) | JSON `[ { id, name, role } ]` активных пользователей (для select в модалке смены) |
| POST | `/quick/expenses` | `bookings:mutate` | Тело: `amount`, `category` ∈ `{salary, purchase, other, prepayment_refund, custom}`, `vendor` (обяз. при `custom`), `payment_method` (default `cash`), `note`. Пишет в `expenses` с `created_by = current_user.id`. Логирование: `logAction('expense')`. JSON-ответ `{ ok }` или `{ error }` со статусом `400`. |
| POST | `/quick/shifts` | `bookings:mutate` | Тело: `user_id`, `shift_date` (default сегодня), `start_time` `HH:MM`, `end_time` `HH:MM`, `note`. Серверный расчёт `hours = (end − start) / 60`. Если `end ≤ start` → `400`. Пишет в `staff_shifts` (новые поля `start_time`, `end_time`, `created_by`); `rate_type='hourly'`, `rate_value=0`. Логирование: `logAction('shift')`. |
| GET | `/quick/today` | `bookings:mutate` | JSON `{ expenses: [...], shifts: [...] }` за сегодня. Расходы — по `created_by = current_user.id`; смены — по `user_id = current_user.id` ИЛИ `created_by = current_user.id`. |
| DELETE | `/quick/expenses/:id` | `owner` (любая) / иначе своя + ≤1 час | Гейт — `canDeleteOwnQuickRecord`; для расхода `creator = expenses.created_by`, `createdAt = expenses.spent_at`. |
| DELETE | `/quick/shifts/:id` | то же | Для смены `creator = COALESCE(staff_shifts.created_by, staff_shifts.user_id)`, `createdAt = staff_shifts.created_at`. |

Окно «1 час» вынесено в константу `QUICK_DELETE_WINDOW_MS` в [utils/rbac.js](../utils/rbac.js). При интерпретации SQLite-меток времени (`YYYY-MM-DD HH:MM:SS` без TZ) хелпер считает их UTC — иначе локальный TZ ломает арифметику (`parseDbTimestamp`).

## 7. Бизнес-логика

### 7.1 Расчёт стоимости позиции — [controllers/bookingController.js](../controllers/bookingController.js) + [utils/bookingPricing.js](../utils/bookingPricing.js)

В колонке `booking_items.price` хранится **единичный тариф** (₽ за человека, ₽ за час, или фикс за единицу), а не «уже умноженная» сумма строки. Сумма строки `booking_items.total` и итог брони считаются одной функцией `computeLineSubtotal` / `computeTotalWithPromo` (как на сервере при `create`/`update`, так и на клиенте в форме).

```
price_type = 'person'  → subtotal = price × quantity строки (участники этой позиции; может отличаться от people_count брони)
price_type = 'fixed'   → subtotal = price × quantity (допы / фикс)
price_type = 'hour'    → subtotal = price × quantity × (duration_minutes / 60)
```

В форме бронирования ([views/bookings/form.ejs](../views/bookings/form.ejs)): для услуг поле «Цена» только для чтения (тариф из каталога); для беседок с типом «за час» поле «Кол-во» в строке заблокировано; для «за чел.» количество в строке редактируется.

Тип цены, если не пришёл с клиента, выводится через `inferPriceType` (квест с `price_per_person` → `person`, иначе приоритет fixed/hour по полям услуги).

`booking.total_price` = сумма строк **минус** промо-скидка в ₽ (`computeHourlyPromoDiscountRub` по часовым позициям при `promo_enabled`), затем округление. Бонусы начисляются от этого итога.

### 7.2 Конфликты по времени

Перед `create` и `update` для каждой позиции с `item_type='service'` и заданным `start_time` сравниваются интервалы `[startTotal, endTotal]` (в минутах от 00:00) с существующими бронями (`status != 'cancelled'`) на ту же дату:

- **Беседки и прочие услуги:** пересечение ищется только при **том же `item_id`** (конкретный ресурс).
- **Категория `quests`:** пересечение с **любой** позицией `quests` в этот день (общий пул), независимо от `item_id`.

При пересечении возвращается `{ error: '...' }`, роут отдаёт 409 и перерисовывает форму.

### 7.3 Бонусы

`bonus_enabled = 1` → при создании брони `bonus_earned = round(total_price * bonus_percent / 100)` начисляется в `bonus_points` по нормализованному `phone` клиента. Списание (`bonus_spent`) пока заводится только в схеме — UI/контроллер списания смотри в форме бронирования (`views/bookings/form.ejs`) и эндпоинте `/bookings/api/bonus/:clientId`.

### 7.4 Промо «час в подарок»

Передаётся в форму через `GET /bookings/api/promo`: `{ enabled, threshold, free_hours, bonus_rate }`. Скидка в рублях по порядку часовых строк (`price_type = hour`) совпадает на клиенте и на сервере (`computeHourlyPromoDiscountRub` в [utils/bookingPricing.js](../utils/bookingPricing.js)); из итога вычитается перед показом и при сохранении `total_price`.

#### Примечание по форме редактирования брони

- `GET /bookings/:id/edit` отрисовывает ту же форму `views/bookings/form.ejs`, но с `booking.items` (нормализовано в `bookingController.getById()` через `toFormBooking`).
- Для устойчивости клиентский скрипт формы сериализует `booking/services/extras` безопасно для `<script>` (экранирует `<`), чтобы значения не могли оборвать тег и “сломать” инициализацию.
- Итог в таблице формы отображается коротко (финальная сумма), а расшифровка (подитог/акция/бонусы) — отдельным блоком под таблицей, чтобы не уезжать за экран.

### 7.5 Сетка дашборда — `bookingController.getDashboardGrid(date)`

- Ресурсы: первые 7 беседок, +1 квест (первая услуга категории `quests`).
- Часы: `08..22` (фиксировано).
- Для каждой брони на дату строим карточку на каждый из её `service`-items (с `_rowspan = endHour - startHour`), остальные затронутые часы помечаются `_skip` (рендерятся как пропуск ячейки).

## 8. Сессии и cookies

`express-session` ([middleware/auth.js](../middleware/auth.js)): при **`DATABASE_URL`** — store **`connect-pg-simple`**, таблица **`user_sessions`** (создаётся при старте, если нет); иначе — MemoryStore (локально / тесты). `cookie.maxAge = 24h`, `httpOnly: true`, в production `secure: true`, `sameSite: 'lax'`. Секрет: **`SESSION_SECRET`** (в production обязателен, ≥32 символов, иначе процесс не стартует); иначе запасной короткий секрет только для dev. См. [docs/SECURITY.md](SECURITY.md), [docs/RUNBOOK.md](RUNBOOK.md) §1.1.

**CSRF:** [middleware/csrf.js](../middleware/csrf.js) для небезопасных методов сравнивает `req.body._csrf` или заголовок `X-CSRF-Token` с `req.session.csrfToken`. В шапке выставляется `<meta name="csrf-token" …>` ([views/partials/header.ejs](../views/partials/header.ejs)); HTML-формы подключают [views/partials/csrf-field.ejs](../views/partials/csrf-field.ejs); мутации через `fetch` в [public/js/main.js](../public/js/main.js) передают тот же токен в заголовке. Для локальной отладки: `DISABLE_CSRF=1`. Регрессия с включённой проверкой: [tests/csrfProtection.test.js](../tests/csrfProtection.test.js).

## 9. Логирование

- В `console` пишутся ошибки маршрутов и DB-инициализации ([server.js](../server.js)).
- В `activity_logs` пишет middleware `logAction(entityType)` (только если статус ответа 2xx и есть `req.session.user`). Сейчас подключён к `/admin/users` (create/update/delete) и `/admin/settings` (save).

## 10. Как использовать (для пользователя)

Подробная инструкция — в [README.md](../README.md). Кратко:

1. `npm install`, `node server.js`.
2. Открыть `http://localhost:3000`, войти под `admin/admin123`.
3. В «Услугах» выбрать ресурсы и допы (есть сидинг 13 услуг + 12 допов).
4. В «Клиенты» завести клиента (или нажать «+ Новый клиент» в форме брони).
5. В «Бронирования» → «Новое бронирование» → выбрать дату/клиента, добавить услуги (мульти-режим) и допы → «Сохранить». При конфликте по времени — увидите понятное сообщение и форма не сбрасывается.
6. Дашборд — переключение по датам через «← / →» / «Сегодня» / выбор даты.
7. Панель руководителя: «Аналитика» (графики Chart.js + CSV-экспорт), «Пользователи», «Журнал», «Настройки».

## 11. Как верифицировать

1. Тест-гейт:

   ```powershell
   npm test
   ```

   Ожидаемо проходят все тесты в `tests/**/*.test.js` (в т.ч. smoke, csrfProtection, hrModule, bookingPricing и др.; точное число см. вывод `npm test`).

2. Ручной чек:

   - Создать брони на одно и то же время и тот же ресурс → должно вернуть конфликт «Время пересекается с бронированием #N: …».
   - Создать клиента → бронь → проверить, что в `data/forest-park.db` появилась запись `bonus_points` с `total_earned > 0`.

## 12. Известные ограничения

См. [docs/QA_REPORT.md](QA_REPORT.md) и [docs/SECURITY.md](SECURITY.md). Главное:

- **Исправлено в коде:** BUG-001 (порядок `/clients/search`), BUG-002 / SEC-01 (параметризация дат/категорий в аналитике и CSV-экспорте броней), SEC-07 / BUG-004 (маскирование `password` в теле для журнала), SEC-03/04 (сессия из `SESSION_SECRET`, флаги cookie в production), BUG-007 (конфликты при `PUT` брони), BUG-003 / BUG-005 / BUG-006 (`getStats` с фильтром дат, загрузка дашборда и часы сетки из `work_start`/`work_end`, корректное отображение времени окончания брони), изоляция тестовой БД через `DB_PATH`.
- Хардкод запасного `SESSION_SECRET` в development и **SHA-256 без соли** для паролей пользователей — по-прежнему см. SECURITY; для production задайте длинный `SESSION_SECRET`.
- Остальные пункты QA/SECURITY (SEC-02, rate-limit и т.д.) — см. карточки в `docs/bugs/` и [docs/SECURITY.md](SECURITY.md). Базовая защита CSRF для HTML-форм и основных `fetch` в `main.js` включена; отключение только через `DISABLE_CSRF=1`.

## 13. Проектирование под VPS и целевая БД

Единый документ: **[docs/VPS_PROJECT.md](VPS_PROJECT.md)** — десять вопросов с **зафиксированными ответами** (§1–2), утверждённая целевая архитектура (Node + PostgreSQL + TLS + бэкапы), baseline по размеру VPS, TLS, бэкапам, мониторингу и политике простоя при деплое.

Кратко: приложение уже умеет **PostgreSQL** при заданном **`DATABASE_URL`** (см. [docker-compose.yml](../docker-compose.yml)); без него — **sql.js**. Схема для Postgres — [scripts/postgres/init.sql](../scripts/postgres/init.sql). Чеклист доработок и проверка связи: [docs/POSTGRES_MIGRATION.md](POSTGRES_MIGRATION.md), `npm run verify-pg`.

## 14. Автосервис CRM — баг-пул 2026-06-18

### Как использовать

| Функция | Где |
| --- | --- |
| VIN при приёмке | Карточка заказа без авто → «Авто и клиент» → поле VIN |
| Несколько мастеров на работу | Карточка заказа → «Работы» → чекбоксы мастеров → одна строка |
| Блок 10–13 в расписании | При создании заказа указать «Окончание» (рядом с «Начало») |
| Многодневный заезд | «Дата окончания» на форме заказа; badge «до ДД.ММ» в календаре |

### Как проверить

```powershell
npm test
```

Регрессии: `tests/orders.test.js`, `tests/orders-carfirst.test.js`, `tests/calendar.test.js`.

### Миграция (Postgres / Railway)

```sql
-- docs/MIGRATE_POSTGRES_RAILWAY_025.sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS scheduled_end_date TEXT;
```

Локально: `npm run migrate` подхватит `migrations/025_scheduled_end_date.sql`.
