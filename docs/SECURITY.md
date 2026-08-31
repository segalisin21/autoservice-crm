# SECURITY — autoservice-crm

> Аудит и статус мер безопасности. Трассировка фиксов: [coordination/HANDOFF.md](../coordination/HANDOFF.md).

## Статус (2026-08)

| ID | Было | Сейчас |
| --- | --- | --- |
| SEC-03 | Hardcoded session secret | `SESSION_SECRET` env, fail-fast в production (≥32) — [lib/sessionSecret.js](../lib/sessionSecret.js) |
| SEC-04 | Cookie без флагов | `httpOnly`, `secure` в production, `sameSite: lax`, `trust proxy` |
| SEC-05 | Нет CSRF | [middleware/csrf.js](../middleware/csrf.js), токен во всех POST-формах |
| SEC-06 | Brute force на login | Rate-limit 5/15 мин — [middleware/loginLimiter.js](../middleware/loginLimiter.js) |
| SEC-02 | SHA-256 без соли | **scrypt** с солью — [lib/password.js](../lib/password.js) |

## 1. Сводка по рискам (legacy + открытые)

| ID | Severity | Категория | Заголовок |
| --- | --- | --- | --- |
| SEC-01 | high | Injection (CWE-89) | SQL-injection в `analyticsController` (см. [BUG-002](bugs/BUG-002.md)) |
| SEC-02 | high | Cryptographic Failure (CWE-916) | Пароли — SHA-256 без соли |
| SEC-03 | high | Hardcoded Secret (CWE-798) | `session.secret` зашит в коде |
| SEC-04 | medium | Session Cookie (CWE-1004/CWE-614) | Нет `httpOnly` / `secure` / `sameSite` |
| SEC-05 | medium | CSRF (CWE-352) | Нет защиты от CSRF на POST/PUT/DELETE |
| SEC-06 | medium | Brute Force (CWE-307) | Нет rate-limit / lockout на `/login` |
| SEC-07 | medium | Sensitive Data Exposure (CWE-532) | `activity_logs.details` хранит `req.body` (включая пароли) |
| SEC-08 | medium | Container Hardening | `Dockerfile` запускает приложение от root |
| SEC-09 | low | Information Disclosure | На странице логина показаны тестовые креды |
| SEC-10 | low | Repo Hygiene | В репозиторий попадают `*.log` и SQLite-файл |
| SEC-11 | low | Authorization | `requireRole` перед mount, но `app.use('/admin', requireRole('admin'), ...redirect)` после конкретных подмаршрутов — поведение корректно, но фрагильно |

## 2. Подробно

### SEC-01. SQL-injection в `analyticsController`
- См. [BUG-002](bugs/BUG-002.md). Пароли всех ENV/учёток в БД могут быть выведены через UNION.
- **Митigation:** все динамические параметры — через `stmt.bind([...])`. Whitelist категорий и валидация формата дат.

### SEC-02. SHA-256 без соли
- В [config/database.js](../config/database.js) и [controllers/userController.js](../controllers/userController.js) пароль хешируется как `crypto.createHash('sha256').update(password).digest('hex')`.
- Угроза: радужные таблицы и быстрый перебор для известных паролей.
- **Митigation:** `bcrypt` (cost ≥ 12) или `argon2id`. Поскольку пароль уходит через POST формы, миграцию можно сделать ленивой:
  ```js
  if (legacySha256(p) === user.password_hash) {
    user.password_hash = bcrypt.hashSync(p, 12);
    saveDB();
  } else if (bcrypt.compareSync(p, user.password_hash)) {
    // ok
  }
  ```
- Дефолтные пользователи `owner/owner123` (владелец), `admin/admin123` (администратор парка) — обязательно менять при первом старте; в идеале — заставлять смену через флаг `must_change_password` в `users`.

### SEC-03. Hardcoded `session.secret`
- В [middleware/auth.js](../middleware/auth.js) — `secret: 'forest-park-secret-key-2024'`.
- Угроза: подделка сессионных cookie (особенно в открытом коде). При компрометации секрета злоумышленник может выписать произвольную сессию.
- **Митigation:**
  ```js
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET is not set');
  const sessionMiddleware = session({ secret, /* ... */ });
  ```
  Сгенерировать сильный секрет (≥ 64 байт), хранить вне репо.

### SEC-04. Session cookie без флагов
- Текущий конфиг:
  ```js
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
  ```
- Нет `httpOnly` (XSS может украсть cookie), `secure` (cookie уйдёт по HTTP), `sameSite` (CSRF проще).
- **Митigation:**
  ```js
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
  ```
- За proxy в проде — `app.set('trust proxy', 1);`.

### SEC-05. CSRF
- Подключён [middleware/csrf.js](../middleware/csrf.js): токен в сессии, `res.locals.csrfToken`, проверка `POST`/`PUT`/`DELETE` (в т.ч. через `method-override`) по полю `_csrf` или заголовку `X-CSRF-Token`. Для автотестов: **`DISABLE_CSRF=1`** отключает проверку (см. `tests/*.test.js`).
- Формы с мутацией следует дополнять скрытым полем (частично через [views/partials/csrf-field.ejs](../views/partials/csrf-field.ejs)). `sameSite: 'lax'` (SEC-04) дополняет, но не заменяет CSRF.
- **EJS:** не передавать в `res.render` локаль с именем **`client`** (объект записи клиента) — в движке EJS это конфликтует с опцией компиляции `client` и ломает `include`; используйте другое имя (в проекте: **`clientRecord`** для [views/clients/form.ejs](../views/clients/form.ejs)).

### SEC-06. Brute force на `/login`
- В [routes/auth.js](../routes/auth.js) нет ограничений по числу попыток на IP/логин и нет CAPTCHA.
- **Митigation:**
  - Rate-limit по IP (`express-rate-limit`, например 5 попыток / 15 мин на `POST /login`).
  - Lockout пользователя: `users.failed_logins`, `users.locked_until`.
  - Лог неуспешных попыток в `activity_logs` (без пароля).

### SEC-07. Утечка через `activity_logs.details`
- См. [BUG-004](bugs/BUG-004.md). `JSON.stringify(req.body).substring(0, 500)` пишет пароли пользователей при создании/обновлении в `/admin/users`.
- **Митigation:** redactor по списку ключей (`password`, `password_confirm`, `token`, `secret`, `_csrf`).

### SEC-08. Docker запускается от root
- [Dockerfile](../Dockerfile):
  ```dockerfile
  FROM node:20-alpine
  ...
  CMD ["node", "server.js"]
  ```
- Нет `USER node`. Контейнер исполняется от root.
- **Митigation:**
  ```dockerfile
  RUN mkdir -p /app/data && chown -R node:node /app
  USER node
  CMD ["node", "server.js"]
  ```
  Также `RUN npm ci --omit=dev` (текущий `--production` устарел).

### SEC-09. Тестовые креды на странице логина
- В [views/auth/login.ejs](../views/auth/login.ejs) в dev видны подсказки с демо-кредами (`owner`, `admin`).
- **Митigation:** удалить блок `.login-hint` для прода (через переменную окружения, например `process.env.SHOW_DEMO_HINT === '1'`).

### SEC-10. Repo hygiene
- В корне валяются `server-error.log`, `server-output.log`, `server.log`, `server_err.log`, файл БД `data/forest-park.db`.
- Файл `.gitignore` — отсутствует.
- **Митigation:** добавить `.gitignore` со списком:
  ```
  node_modules/
  data/*.db
  data/*.db-journal
  *.log
  .env
  .env.*
  ```
  Удалить из репо логи (`git rm --cached server*.log`).

### SEC-11. Хрупкая регистрация ролевых guard'ов
- В [server.js](../server.js) разделы админки и каталога навешиваются через **`requirePermission(...)`** (например `admin:users`, `services:manage`, `admin:salary`) плюс feature-флаги где нужно.
- Риск: при добавлении нового маршрута забыть нужный guard. Имеет смысл держать сверку с [PAGES.md](PAGES.md) / приложением A и прогон `npm test`.

## 3. Рекомендуемый порядок исправлений

1. SEC-01 (SQLi) + SEC-07 (логгер) — high-impact, минимальный диф.
2. SEC-03, SEC-04, SEC-05 — комплект по сессии + CSRF.
3. SEC-02 — миграция на bcrypt с ленивым reHash.
4. SEC-06 — rate-limit на login.
5. SEC-08, SEC-09, SEC-10 — операционная гигиена.
6. SEC-11 — рефакторинг при ближайшей правке `server.js`.

## 4. Из коробки уже хорошо

- Параметризованные запросы используются почти везде, кроме `analyticsController` (см. SEC-01).
- Доступ **`admin` (парк)** к системным разделам (`admin:users`, `admin:settings`, `admin:logs`, `admin:access`, `admin:salary`) и к финансовым KPI на дашборде блокируется матрицей `role_permissions` и `requirePermission` в [server.js](../server.js). У **`owner`** — полный набор прав и обход проверок `requirePermission` в [middleware/auth.js](../middleware/auth.js).
- Сессии не сохраняются автоматически до логина (`saveUninitialized: false`).
- DB-файл изолирован в `data/`; через Docker монтируется в named volume `db-data`.

## 4a. Матрица доступа (фактически реализовано)

> Простое описание страниц «по-человечески» с матрицей по каждому разделу — в [PAGES.md](PAGES.md).
>
> Актуальная матрица по разделам — [PAGES.md](PAGES.md) §0 и приложение A. Ниже — сжатая сверка.

| Раздел / URL-префикс | `owner` | `admin` (парк) | `instructor` / `cleaner` | Гейт (где проверяется) |
| --- | --- | --- | --- | --- |
| `/login`, `/logout` | open | open | open | публично |
| `/`, `/dashboard/grid` | full + фин. KPI | операц. KPI, без фин. агрегатов | просмотр; сетка: инструктор — `quests` | `dashboard:view`, [utils/rbac.js](../utils/rbac.js) |
| `/clients/*` | по матрице | по умолчанию full CRUD | обычно нет доступа | `clients:view` / `clients:mutate` |
| `/bookings` (просмотр) | да | да | да | `bookings:view` |
| мутации броней, `GET /bookings/api/catalog` | да | да | **403** | `bookings:mutate`, `canMutateBookings` |
| `/services/*`, `/extras/*` | да | да | нет | `services:manage`, `extras:manage` |
| `/quick/*` | да | да | нет | `bookings:mutate` |
| `/admin/reports/*` | да | да | нет | `admin:reports` |
| `/admin/finance/*`, `/admin/users/*`, `/admin/logs/*`, `/admin/settings/*`, `/admin/access` | да (по матрице) | **нет** (дефолт) | нет | соответствующие `admin:*` |
| `POST /admin/demo-preview` | да | да | **403** | `requireRole('admin', 'owner')` + `demo_mode_enabled` |

Легаси-роли в БД (`operator`, …) нормализуются к **`admin`**. Устаревшая роль `manager` в данных мигрирует в **`admin`** при старте БД.

### 4a.1 Демо-предпросмотр ролей и безопасность

Демо-режим (`demo_mode_enabled` + `session.demoPreviewRole`) — **UX-инструмент**, не понижение привилегий.

- **`requirePermission` / матрица** проверяют **реальную** роль из сессии, не `effectiveRole`. Учётка с полными правами по-прежнему откроет закрытый для предпросмотра URL — by design.
- `effectiveRole` ([utils/demoPreview.js](../utils/demoPreview.js)) влияет на навигацию, бейдж в шапке, фильтры дашборда/броней.
- `POST /admin/demo-preview` — только для **`owner`** и **`admin`** (`requireRole('admin', 'owner')`). Линейный персонал и настройка `demo_mode_enabled` (через `/admin/settings`) — только у кого есть соответствующие права.

Вывод: предпросмотр **не снижает** серверные гейты; для реального read-only нужен отдельный механизм в проверках прав.

## 5. Предоплата при `payment_status=partial`

- Итоговая сумма предоплаты **проверяется только на сервере** ([`controllers/bookingController.js`](../controllers/bookingController.js) + [`utils/prepaymentRules.js`](../utils/prepaymentRules.js)); клиентское автозаполнение в форме брони не является границей доверия.
- Подделка `prepayment_amount` в HTTP-теле при обходе клиентской валидации отклоняется ответом с ошибкой, если сумма не совпадает с ожидаемой (±0,02 ₽).

## 6. Что НЕ входит в этот аудит

- Фактические exploit-PoC (только описание векторов).
- Анализ зависимостей через `npm audit` — выполняется отдельно.
- Сетевые/инфраструктурные аспекты (TLS, WAF, обратный proxy) — задаются на уровне деплоя.

## 7. Примечание по безопасной сериализации данных в EJS

- В формах, где сервер сериализует данные в `<script>` через `JSON.stringify(...)`, важно предотвращать сценарий, когда пользовательский ввод содержит последовательность `</script>` и преждевременно закрывает тег.
- В `views/bookings/form.ejs` используется экранирование символа `<` в JSON (`<` → `\\u003c`), чтобы избежать таких поломок и последующих сбоев инициализации формы (что влияло бы на качество продукта).

## 8. Автосервис CRM — мастера и VIN (2026-06-18)

### Валидация `master_ids[]`
- `validateMasterIds` в `orderController.js` принимает только `users.id` с `is_active = 1` и ролью `master`, `manager` или `owner`.
- Подмена чужих user_id в payroll отклоняется (не попадают в `order_line_payroll`).

### VIN
- `normalizeVin`: trim, uppercase, max разумной длины через trim (17 символов стандарт; пустое → NULL).
- VIN не логируется в `activity_logs` при мутациях заказа.
