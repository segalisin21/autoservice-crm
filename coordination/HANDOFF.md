# HANDOFF

## 2026-06-02 — Первичный импорт из Google-таблицы + деплой Railway

### What changed
- Импорт `Учет - Лист1 (1).csv` (648 строк) в чистую БД: **266 заказов, 648 строк, 410 услуг каталога, 5 сотрудников**.
- `lib/uchetCsv.js`: `buildOrderGroups` считает `primaryMaster` группы.
- `scripts/import-uchet-csv.js`: проставляет `scheduled_date` и `assigned_user_id`; Виталик создаётся как `owner` (логин `vitalik`); импорт **идемпотентен** (пропуск на непустой БД); путь к CSV по умолчанию — корневой файл / `IMPORT_CSV`.
- `scripts/seed-owner.js`: креды можно задавать через `OWNER_USERNAME`/`OWNER_PASSWORD`; отсутствие — не фатально (для прод-старта).
- `package.json`: `start:prod` = migrate → import → seed:owner → server.
- `railway.json` + `docs/DEPLOY_RAILWAY.md` — деплой на Railway (SQLite + Volume), создание БД и импорт.

### Решения заказчика
- Виталик = `owner`, ЗП за его работы начисляется как у всех (net_percent 50%).
- Строки «расходники» оставлены как есть (входят в базу ЗП).

### Verify
```bash
npm test            # 33/33
# чистый импорт локально:
Remove-Item data\dev.sqlite3* -ErrorAction SilentlyContinue
npm run import:uchet -- "Учет - Лист1 (1).csv"
node scripts/seed-owner.js --username owner --password owner
```
Логины: `vitalik`/`master` (владелец), `owner`/`owner`, `master_1..5`/`master`.

### Risks / known limitations
- В таблице нет ФИО/телефонов владельцев и госномеров — все авто на служебном клиенте «Учёт (импорт)», поиск по госномеру для истории пуст.
- Импорт только первичный (не инкрементальный): для перезаливки очистить БД (см. деплой-доку п.7–8).
- Railway — на SQLite+Volume; Postgres потребует переписать `datetime('now')`/`date('now')` в миграциях и запросах.

---

## 2026-06-02 — CRM v2: ЗП/расходы/расписание/документы/фото/сотрудники/PWA

### What changed
- **ЗП (гибкая)**: режим `net_percent` = 50% от (работы − расходники). Расходники = `order_lines.cost_price` товаров + расходы категории `materials`, привязанные к заказу; распределяются между мастерами пропорционально их работам. Настройки: формула по умолчанию (`settings.payroll_default_*`), правило по мастеру, переопределение по конкретной работе (фикс/процент). См. `lib/payroll.js`, `lib/settings.js`, `/admin/payroll`.
- **Расходы**: `/expenses` (CRUD), права `expenses:view/mutate`, влияют на финансы (`expenses_total`, `net_profit`). См. `controllers/expenseController.js`, `lib/expenses.js`.
- **Расписание сотрудник×часы** вместо мест гаража: главная — месяц→день, колонки = сотрудники, карточки со временем. Поля заказа `assigned_user_id`, `start_time`, `end_time`. См. `lib/calendarData.js`, `controllers/dashboardController.js`, `views/dashboard.ejs`.
- **Запись от машины + поиск по госномеру**: форма заказа ищет авто по номеру и позволяет инлайн-создать авто+владельца. См. `controllers/orderController.js` (`showNew`, `resolveOrCreateCar`).
- **Документы (печать)**: заказ-наряд `/orders/:id/print`, акт приёма-передачи `/orders/:id/act-acceptance`, акт выполненных работ `/orders/:id/act-completion`.
- **Фото работ**: загрузка (multer) в `data/uploads/orders/:id/`, защищённая отдача `/orders/:id/photos/:photoId/file`, удаление. Таблица `order_photos`.
- **Сотрудники и доступ**: `/admin/users` (создание/роль/пароль/активность). Роль персонала — `master`.
- **Аналитика (деньги)**: KPI месяца на дашборде для owner/admin (касса, выручка, расходы, прибыль, дебиторка).
- **PWA**: `public/manifest.webmanifest`, `public/icons/icon.svg`, `public/js/sw.js`, регистрация SW в `public/js/app.js`.

### Migrations
- `004_expenses.sql`, `005_order_costs.sql` (`order_lines.cost_price`), `006_scheduling.sql` (`orders.assigned_user_id/start_time/end_time`), `007_order_photos.sql`.

### Verify
```bash
npm rebuild better-sqlite3   # при смене версии Node
npm run migrate
npm test                     # 33/33 pass
npm start
```

### Notes / limitations
- `bay` остаётся в схеме (миграция 003), но не используется в UI (задел под «хоз. блок»).
- `data/` (включая загруженные фото и SQLite) в `.gitignore`.

---

# HANDOFF (история)

## 2026-05-27 — Календарь гаража (стиль Belka) + 4 места

### What changed
- UI в стиле **Belka 2,0**: `public/css/style.css`, sidebar, зелёная тема (`views/partials/layout-top.ejs`).
- **Главная** `/` — календарь месяца (счётчик заказов/выручка по дням) и **день** — 4 колонки «Место 1…4» с карточками заказов.
- Поля заказа: `scheduled_date`, `bay` (миграция `migrations/003_garage_bay.sql`).
- Форма заказа: дата + место в гараже.

### Key files
- `controllers/dashboardController.js`, `lib/calendarData.js`, `lib/garage.js`
- `views/dashboard.ejs`, `public/css/autoservice.css`
- `tests/calendar.test.js`

### Verify
```bash
npm run migrate
npm test
npm start
```
Открыть: http://localhost:3000/ (месяц) → клик по дню → 4 колонки.

---

## 2026-05-27 — Учёт из Excel (Учет - Лист1.csv)

### What changed
- Поле заказа `work_type`: Мойка / Электрика / Продажа (как колонка «Тип работ»).
- Экран **Журнал** `/journal` — таблица как в Excel (дата, тип, авто, мастер, услуга, цена, оплата).
- Импорт CSV: `npm run import:uchet -- "путь\к\файлу.csv"` или `import-uchet.bat`.
- Каталог и мастера создаются из файла; заказы группируются по **дата + автомобиль**; оплата — из колонки «Оплата».

### Verify
```bash
npm rebuild better-sqlite3
npm run migrate
npm run import:uchet -- "c:\open cod\auto\Учет - Лист1.csv"
npm start
```
Открыть: http://localhost:3000/journal

---

## 2026-05-27 — Зарплата + финансы/отчёты

### What changed
- Зарплата: правила `master_comp_rules`, overrides, фиксация `earned` при закрытии заказа (`lib/payroll.js`).
- Экран `/admin/payroll`: начисления/выплаты/к выплате; owner — правила и выплаты.
- Финансы `/admin/finance`: cash-in, выручка по закрытым, gross/net, скидки, налоги, дебиторка.
- Отчёты `/admin/reports`: топ услуг, экспорт CSV.
- RBAC: master видит только свою зарплату; finance — только owner.

### Key files
- `lib/payroll.js`, `lib/finance.js`
- `controllers/payrollController.js`, `controllers/financeController.js`
- `routes/admin-payroll.js`, `routes/admin-finance.js`
- `tests/payroll-finance.test.js`

### Verify
```bash
npm test
```

---

## 2026-05-27 — Каталог + заказы

### What changed
- Каталог работ/товаров: CRUD, фильтры, toggle активности.
- Заказы: создание, строки work/product, пересчёт итогов (`lib/orderTotals.js`).
- Скидки (amount/percent/scope), налоги (snapshot + расчёт), оплаты, печать `/orders/:id/print`.
- Настройки налогов в `settings` (`lib/settings.js`).
- Тесты заказов: totals, скидка works_only, налог 20%, оплата.

### Key files
- `controllers/catalogController.js`, `controllers/orderController.js`
- `routes/catalog.js`, `routes/orders.js`
- `lib/orderTotals.js`, `lib/money.js`, `lib/settings.js`
- `tests/orders.test.js`

### Verify
```bash
npm test
```

### Risks / limitations
- Заработок мастера при `completed` — следующий этап (payroll).
- Финансовые отчёты owner — следующий этап.

---

## 2026-06-02 — PostgreSQL support for Railway

### What changed
- Postgres migrations in `migrations/postgres/`, dialect-aware runner.
- `config/sqlDialect.js`, `insertReturning`, SSL pool in `database.js`.
- Runtime SQL updated for both SQLite and Postgres.
- Sessions stored in Postgres via `connect-pg-simple` when `DATABASE_URL` is set.

### Key files
- `config/database.js`, `config/sqlDialect.js`, `config/migrations.js`
- `migrations/postgres/*.sql`, `server.js`, controllers/lib/scripts

### Verify
```bash
npm test
```

### Railway Postgres setup
1. Add PostgreSQL plugin → reference `DATABASE_URL` in app service.
2. Set `SESSION_SECRET`, `NODE_ENV=production`, `OWNER_USERNAME`/`OWNER_PASSWORD`.
3. Redeploy — no Volume needed.

---

### What changed
- `trust proxy` + `proxy: true` для session cookie за HTTPS-прокси Railway.
- Явный `req.session.save()` перед redirect после логина.
- Подсказка на странице входа: `vitalik` / `master` или `OWNER_USERNAME`.
- Регрессионный тест сессии в production за прокси.

### Key files
- `server.js`, `routes/auth.js`, `views/login.ejs`, `tests/smoke.test.js`

### Verify
```bash
npm test
```

### Risks / limitations
- На Railway нужны `NODE_ENV=production`, `SESSION_SECRET`, `OWNER_USERNAME`/`OWNER_PASSWORD` (или логин `vitalik`/`master` после импорта CSV).


### What changed
- RBAC: `config/permissions.js`, `requirePermission` в `middleware/auth.js`, сид матрицы при логине.
- CRUD клиентов и автомобилей с нормализацией телефона/номера (`lib/normalize.js`).
- Напоминания по авто (добавить/переключить/удалить).
- EJS-шаблоны со общей навигацией.
- Тесты: normalize, clients-cars, smoke на изолированной SQLite.

### Key files
- `config/permissions.js`, `controllers/clientController.js`, `controllers/carController.js`
- `routes/clients.js`, `routes/cars.js`
- `tests/helpers/testApp.js`, `tests/clients-cars.test.js`

### Verify
```bash
npm test
```

### Risks / limitations
- Postgres: `datetime('now')` в UPDATE — позже заменить на совместимые выражения.
- CSRF пока не включён.
- Следующий этап: каталог и заказы.
