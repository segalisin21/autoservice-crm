# HANDOFF

## 2026-06-15 — тесты: скорость и регрессии

### What changed
- **Баг**: `carController.create` — 14 колонок, 13 плейсхолдеров (`13 values for 14 columns`); создание авто падало и могло подвешивать раннер.
- **Тесты**: актуализированы под пустые списки / `data-table-compact` / дебиторку только по незавершённым заказам.
- **Скорость**: `tests/helpers/testApp.js` кэширует Express-приложение (сброс кэша при смене `NODE_ENV`); полный прогон ~80 с (140 тестов).

### Key files
- `controllers/carController.js`, `tests/helpers/testApp.js`, `tests/analytics-ui.test.js`, `tests/order-economics.test.js`, `tests/orders.test.js`

### Verify
```bash
npm test
```

### Risks
- Кэш `server` в тестах: при добавлении тестов с другими env-переменными, влияющими на `server.js` при require, может понадобиться инвалидация кэша.

---

## 2026-06-15 — расписание: rowspan для многочасовых карточек

### What changed
- Многочасовые заказы в почасовой сетке (`schedule-time-grid`) используют `rowspan` на `<td>` вместо `position: absolute` + фиксированной высоты 36px.
- Ячейки, покрытые span (`coveredBySpan`), больше не рендерятся отдельно.
- Регрессионный тест: заказ 10:00–13:00 → `span_rows=3`, `rowspan="3"` в HTML.

### Key files
- `views/partials/schedule-time-grid.ejs`, `public/css/autoservice.css`, `lib/calendarData.js`, `tests/calendar.test.js`

### Verify
```bash
npm test
```

### Risks
- При нескольких заказах в одном часовом слоте `rowspan` не применяется (как и раньше — только одиночный span).

---

## 2026-06-15 — Виталик в колонках расписания

### What changed
- Флаг `users.show_in_schedule`: мастера и `vitalik` по умолчанию в календаре; чекбокс в карточке сотрудника.
- Миграция `024_users_show_in_schedule.sql`.

### Verify
```bash
npm test
```

---

## 2026-06-15 — расписание: порядок мастеров, перенос заказов

### What changed
- В таблице дня колонки только для мастеров (менеджеры скрыты).
- Порядок колонок: `users.schedule_order`, стрелки ← → в заголовках (`POST /schedule/columns/reorder`).
- Перенос заказа в сетке: drag-and-drop и выпадающий список мастера → `PATCH /orders/:id/schedule`.
- Миграция `023_users_schedule_order.sql`.

### Key files
- `lib/calendarData.js`, `controllers/scheduleController.js`, `controllers/orderController.js`, `controllers/dashboardController.js`
- `views/partials/schedule-time-grid.ejs`, `views/dashboard.ejs`, `views/partials/order-card.ejs`, `public/js/schedule-day.js`
- `migrations/023_users_schedule_order.sql`, `docs/MIGRATE_POSTGRES_RAILWAY_023.sql`
- `tests/calendar.test.js`, `tests/orders-schedule.test.js`

### Verify
```bash
npm test
```

### Risks
- Заказы с `assigned_user_id` = менеджер попадают в «Без сотрудника».
- Drag на другой час ставит `start_time` на `HH:00` (без минут).

---

## 2026-06-14 — orders list make and model columns

### What changed
- Список заказов: отдельные колонки «Госномер», «Марка», «Модель» (данные из `cars`).

### Key files
- `controllers/orderController.js`, `views/orders/list.ejs`

### Verify
```bash
npm test
```

---

## 2026-06-14 — optional work type on order create

### What changed
- При создании заказа тип работ необязателен (в т.ч. клиентская валидация `work-type-picker.js`).
- При сохранении «Детали заказа» на карточке — по-прежнему обязателен.

### Key files
- `public/js/work-type-picker.js`, `views/partials/work-type-checkboxes.ejs`
- `views/orders/form.ejs`, `views/orders/show.ejs`

### Verify
```bash
npm test
```

---

## 2026-06-14 — order card mileage

### What changed
- На карточке заказа справа от авто — поле «Пробег, км»; сохраняется в `cars.mileage` (`POST /orders/:id/mileage`).
- Заказ-наряд и акт приёма показывают пробег из карточки авто.

### Key files
- `controllers/orderController.js`, `routes/orders.js`, `views/orders/show.ejs`, `views/orders/print.ejs`
- `tests/orders.test.js`

### Verify
```bash
npm test
```

---

## 2026-06-14 — payroll excludes product-tab materials

### What changed
- ЗП (`net_percent`): из базы вычитается только `cost_price` на **строке работы** (расходник из прайса).
- Товары во вкладке «Товары» и привязанные `expenses.materials` влияют на P&L, но **не уменьшают** начисление мастеру.

### Key files
- `lib/payroll.js`, `controllers/orderController.js`, `tests/payroll-net.test.js`

### Verify
```bash
npm test
```

---

## 2026-06-14 — separate order comments

### What changed
- `orders.notes` — комментарий при записи (форма создания, блок «Детали заказа»); показывается в шапке карточки.
- `orders.annotation_notes` — комментарий мастера в блоке «Комментарий и фото»; поля не пересекаются.

### Key files
- `migrations/021_orders_annotation_notes.sql`, `controllers/orderController.js`
- `views/orders/form.ejs`, `views/orders/show.ejs`
- `tests/roles-rbac.test.js`, `tests/orders-carfirst.test.js`

### Verify
```bash
npm test
```

---

## 2026-06-14 — delete order

### What changed
- `DELETE /orders/:id` (`orders:mutate`): удаление заказа с каскадом строк/оплат и очисткой файлов фото.
- Кнопка «Удалить заказ» на карточке и в списке (менеджер/admin/owner); мастер — 403.

### Key files
- `controllers/orderController.js`, `routes/orders.js`
- `views/orders/show.ejs`, `views/orders/list.ejs`
- `tests/orders.test.js`

### Verify
```bash
npm test
```

---

## 2026-06-14 — order consumables from catalog

### What changed
- Расходник работы подтягивается из `catalog_items.default_material_cost` при выборе услуги из прайса (UI + бэкенд); поле «Расходник» на строке работы редактируемое.
- Убран блок «Расходники по заказу» (ручной ввод через `expenses` на карточке заказа). Доп. закупки — через вкладку «Товары».

### Key files
- `views/orders/show.ejs`, `public/js/catalog-autocomplete.js`, `controllers/orderController.js`

### Verify
```bash
npm test
```

---

## 2026-06-14 — order create without car

### What changed
- При создании заказа достаточно **даты, времени начала и сотрудника**; комментарий и авто — необязательны.
- `orders.car_id` nullable (migration `020_orders_car_nullable.sql`).
- На карточке заказа без авто — блок «Авто и клиент» (`POST /orders/:id/car`).

### Key files
- `migrations/020_orders_car_nullable.sql`, `controllers/orderController.js`, `views/orders/form.ejs`, `views/orders/show.ejs`
- `lib/calendarData.js`, `tests/orders-carfirst.test.js`

### Verify
```bash
npm test
```

---

## 2026-06-14 — minimal new order form

### What changed
- `/orders/new`: обязательны дата, время начала, сотрудник и идентификатор авто (поиск по госномеру или выбор из базы).
- Комментарий и прочие поля (окончание, тип работ, марка/владелец) — опционально, в блоке «Дополнительно (заполнить при приёмке)».
- Новый авто по одному госномеру: stub-клиент «Уточнить при приёмке» без обязательного ФИО/телефона.
- `work_type` при создании может быть пустым; при редактировании заказа — по-прежнему обязателен.

### Key files
- `views/orders/form.ejs`, `controllers/orderController.js`
- `tests/orders-carfirst.test.js`, `tests/helpers/orderCreate.js`, `tests/orders.test.js`

### Verify
```bash
npm test
```

---

## 2026-06-14 — hide order money for staff

### What changed
- Флаг `showMoney` (`canViewOrderMoney`: owner/admin/manager) — мастер не видит суммы заказов.
- Календарь/расписание: скрыты суммы в месячной сетке, day-summary, KPI «Сумма за день», карточках заказов и time-grid.
- Список заказов: колонки «Итого»/«Долг» для manager и выше; мастер — без сумм в календаре и карточке заказа.
- Карточка заказа для мастера: без долга, без цен/сумм по работам.

### Key files
- `middleware/loadUserPermissions.js`, `controllers/dashboardController.js`
- `views/dashboard.ejs`, `views/partials/order-card.ejs`, `views/partials/schedule-time-grid.ejs`
- `views/orders/list.ejs`, `views/orders/show.ejs`
- `tests/roles-rbac.test.js`

### Verify
```bash
npm test
```

---

## 2026-06-14 — roles master and manager

### What changed
- Новая роль `manager`: календарь, заказы, клиенты, авто, оплаты; без журнала/финансов/админки.
- Роль `master` ужесточена: только календарь, карточка заказа (read-only работы), комментарий/фото (`orders:annotate`), своя ЗП; `/orders` → редирект на `/`.
- Permission `orders:annotate`; middleware `loadUserPermissions`; меню фильтруется по `can()`.
- Маршрут `POST /orders/:id/notes`; фото — `orders:mutate` или `orders:annotate`.

### Key files
- `config/permissions.js`, `middleware/loadUserPermissions.js`, `middleware/auth.js`
- `controllers/orderController.js`, `routes/orders.js`, `routes/dashboard.js`, `routes/journal.js`
- `views/partials/layout-top.ejs`, `views/partials/mobile-nav.ejs`, `views/orders/show.ejs`
- `controllers/userController.js`, `tests/roles-rbac.test.js`

### Verify
```bash
npm test
```

---

## 2026-06-14 — compact payroll tables

### What changed
- Страница `/admin/payroll`: сводка по сотрудникам — компактная таблица с раскрытием строк (начисления, выплаты, быстрая выплата).
- Блоки правил объединены: формула по умолчанию, правила мастеров, переопределения — таблицы с inline-формами в `tfoot`.
- Выплаты: компактная форма + таблица истории в одной секции.
- Удаление переопределений — красный крестик.

### Key files
- `views/admin/payroll.ejs`
- `public/css/autoservice.css`

### Verify
```bash
npm test
```
Визуально: `/admin/payroll`.

---

## 2026-06-14 — compact order detail page

### What changed
- Страница заказа `/orders/:id`: форма добавления работы уплотнена — мастера в одну строку чекбоксов, поля в компактной сетке.
- Убраны плавающие кнопки «+ Работа» / «Оплата» (order-fab-bar) — перекрывали контент при скролле.
- Действия в таблице работ: ✓ и × в одну строку; удаление красное.
- Глобальный класс `.btn-delete` / `.btn-line-delete` — красные кнопки и крестики удаления (каталог, клиенты, авто, сотрудники, отсутствия).

### Key files
- `views/orders/show.ejs`
- `public/css/autoservice.css`
- `views/catalog/list.ejs`, `views/dashboard.ejs`, `views/clients/show.ejs`, `views/cars/show.ejs`, `views/admin/users.ejs`

### Verify
```bash
npm test
```
Визуально: `/orders/:id` — блок мастеров, таблица работ, нет FAB-кнопок внизу.

---

## 2026-06-14 — fix inline toolbar layout overlap

### What changed
- Исправлено налезание кнопок в фильтрах: глобальное правило `.content input/select { width: 100% }` больше не ломает горизонтальные toolbar-формы.
- Добавлен класс `.form-inline` и исключения для `.orders-filter-form`, `.catalog-toolbar__filters`, `.finance-dashboard__toolbar`, `.filters-form`, `.plate-search-form`, `.staff-absences-form`.
- На `/orders` кнопки «Найти» и «+ Заказ» вынесены в `.form-inline__actions` без перекрытия.
- Аналогичный класс применён к фильтрам: каталог, зарплата, журнал, расходы, клиенты, авто, поиск по госномеру.
- Карточки расписания переведены на flex-column, чтобы текст не наезжал друг на друга.

### Key files
- `public/css/autoservice.css`
- `views/orders/list.ejs`, `views/catalog/list.ejs`, `views/admin/payroll.ejs`
- `views/journal/index.ejs`, `views/expenses/index.ejs`, `views/clients/list.ejs`, `views/cars/list.ejs`
- `views/orders/form.ejs`, `views/partials/plate-search-bar.ejs`

### Verify
```bash
npm test
```
Визуально: `/orders`, `/catalog`, `/admin/payroll`, `/clients`, `/cars`, дашборд (поиск по номеру).

### Risks / known limitations
- На очень узких экранах фильтры переносятся на несколько строк — это ожидаемо; кнопки не должны перекрываться.

---

## 2026-06-14 — compact UI pass (tables-first)

### What changed
- Введён глобальный compact-слой в стилях: уменьшены отступы контента/карточек/таблиц/контролов через переменные плотности.
- Каталог переведён в табличный режим по умолчанию; действия по строке унифицированы кнопками; форма каталога уплотнена в двухколоночную сетку.
- Дневной календарь уплотнён: KPI вынесены в верхнюю strip-строку, блок отсутствий перенесён вниз в сворачиваемую таблицу, сетка расписания сделана компактнее.
- Карточка заказа: блок «Работы» переведён из вертикальных карточек в редактируемую компактную таблицу (сохранение и удаление на существующих endpoint’ах).
- Финансы/аналитика/зарплата: заказы в финансах отображаются таблицей, KPI и стат-блоки уплотнены; таблицы правил/переопределений/истории выплат в ЗП переведены на `data-table-compact`.

### Key files
- `public/css/style.css`, `public/css/autoservice.css`
- `controllers/catalogController.js`
- `views/catalog/list.ejs`, `views/catalog/form.ejs`
- `views/dashboard.ejs`, `views/partials/order-card.ejs`, `views/partials/schedule-time-grid.ejs`
- `views/orders/show.ejs`
- `views/admin/finance.ejs`, `views/admin/reports.ejs`, `views/admin/payroll.ejs`

### Verify
```bash
npm test
```

### Risks / known limitations
- В `views/orders/show.ejs` редактирование строк работ использует отдельные формы на каждую строку через `form="id"`; нужно вручную проверить UX на мобильной ширине.
- В расписании дня сохранён серверный SSR-поток данных; для дальнейшего ускорения интерфейса может понадобиться отдельный JSON endpoint.

---

## 2026-06-08 — UX Vitalik: календарь, госномер, марки/модели, прайс

### What changed
- **Главная**: календарь/расписание первым блоком; KPI компактно; поиск по госномеру внизу.
- **Госномер**: `lib/plateFormat.js`, `public/js/plate-input.js` — ввод букв подряд, затем цифр; автоформат `А123ВС777`; валидация при сохранении.
- **Справочник авто**: миграция `011_vehicle_catalog.sql`; sync с Auto.ru (`lib/autoruCatalog.js`, `npm run sync:vehicles`); API `/api/vehicles/*`; autocomplete в формах авто/заказа.
- **Прайс/услуги**: карточки каталога; autocomplete в заказе (`/api/catalog/search`); `npm run import:price` для upsert из CSV.

### Key files
- `views/dashboard.ejs`, `public/css/autoservice.css`
- `lib/plateFormat.js`, `lib/autoruCatalog.js`, `lib/vehicleCatalog.js`
- `routes/apiVehicles.js`, `routes/apiCatalog.js`
- `public/js/plate-input.js`, `vehicle-autocomplete.js`, `catalog-autocomplete.js`
- `views/cars/form.ejs`, `views/orders/form.ejs`, `views/orders/show.ejs`, `views/catalog/list.ejs`

### Verify
```bash
npm test
npm run import:price
npm run sync:vehicles -- --quick
```

### Risks
- Sync Auto.ru: ~80 марок по кнопке в UI (таймаут); полный sync — CLI `npm run sync:vehicles`.
- LIKE-поиск каталога чувствителен к регистру кириллицы в SQLite.

---


### What changed
- **Аналитика**: убраны часы начала, статусы, оплата завершённых, топ клиентов; оставлены дневные/месячные графики, тип работ, топ услуг.
- **Экономика заказов**: компактная таблица с итогами вместо карточек-waterfall.
- **Заказы**: единая `data-table` на ПК и телефоне (горизонтальный скролл).
- **ЗП**: `<details>` по сотруднику — начисления по работам, выплаты за период, быстрая форма выплаты на остаток.

### Verify
```bash
npm test
```

---

## 2026-06-02 — фаза 2+3 UX/данные + полная миграция Postgres

### What changed
- **Фаза 2**: поиск по госномеру (дашборд, список заказов), фильтр «С долгом», баннер долга на карточке заказа; вкладка **Расходы** в admin subnav; CSS `due-badge`, `order-due-alert`, inline plate search.
- **Фаза 3**: миграции `009_activity_logs`, `010_payout_period`; `lib/activityLog.js` (аудит правки строк в **completed**); CSV export `masters`, `work_types`, `receivables`; период выплат в payroll.
- **Импорт**: `import-uchet-csv.js --dry-run`; `scripts/verify-uchet-import.js`.
- **Postgres**: [`docs/MIGRATE_POSTGRES_FULL.sql`](docs/MIGRATE_POSTGRES_FULL.sql) (001–010 + registry); пересборка: `node scripts/build-postgres-full-migration.js`.

### Key files
- `views/partials/plate-search-bar.ejs`, `views/orders/list.ejs`, `controllers/orderController.js`
- `migrations/postgres/009_activity_logs.sql`, `010_payout_period.sql`
- `lib/activityLog.js`, `lib/analytics.js`, `controllers/analyticsController.js`
- `docs/MIGRATE_POSTGRES_FULL.sql`, `scripts/build-postgres-full-migration.js`

### Verify
```bash
npm test
node scripts/import-uchet-csv.js --dry-run path/to/file.csv
node scripts/verify-uchet-import.js
```

### Risks
- Фильтр `due_only` отсекает долг после выборки страницы (N+1 оплат) — на больших списках может понадобиться SQL-агрегация.
- Telegram-уведомления не входили в scope.

---

## 2026-06-02 — fix(analytics): PostgreSQL monthly chart (no strftime)

### What changed
- `getMonthlyComparison` всегда выполнял SQLite `strftime` до ветки postgres → 500 на Railway.
- Добавлен `sqlMonthYmd` в [`config/sqlDialect.js`](config/sqlDialect.js); один запрос по `db.dialect`.

### Verify
```bash
npm test
```

---

## 2026-06-02 — UX статусов, дашборд KPI, аналитика оплат

### What changed
- Заказ `completed`/`cancelled`: **status-badge** вместо текста; список заказов — badge в таблице.
- Главная (owner/admin): блок «Финансы за месяц» на `finance-kpi-card` + ссылка `/admin/finance`.
- `getPaymentDistribution`: один SQL с JOIN (без N+1 по заказам).
- Тесты: payment buckets, badge на закрытом заказе.

### Verify
```bash
npm test
```

---

## 2026-06-02 — UI финансов и аналитики (Belka 2,0)

### What changed
- **Навигация**: нижнее меню скрыто на admin-страницах (`page-finance`, `page-reports`, `page-payroll`, …); сайдбар «Аналитика»; активный пункт «Финансы».
- **Subnav**: [`views/admin/_admin-subnav.ejs`](views/admin/_admin-subnav.ejs) — Сводка / Экономика / Зарплата / Аналитика.
- **Финансы**: [`views/admin/finance.ejs`](views/admin/finance.ejs) — `finance-kpi-card`, toolbar, chips, водопад, badges статусов.
- **Аналитика**: [`lib/analytics.js`](lib/analytics.js), [`controllers/analyticsController.js`](controllers/analyticsController.js), [`routes/admin-reports.js`](routes/admin-reports.js), [`views/admin/reports.ejs`](views/admin/reports.ejs) + Chart.js [`public/js/admin-reports.js`](public/js/admin-reports.js); API `GET /admin/reports/api/data`.
- **Статусы**: CSS `.status-scheduled`, `.status-in_progress`, `.status-ready`.

### Verify
```bash
npm test
```

---

## 2026-06-02 — Экономика заказов, редактирование работ, ЗП, поиск по номеру

### What changed
- **Дашборд** [`/admin/orders-economics`](views/admin/orders-economics.ejs): водопад по заказу (выручка → расходники → ЗП → прибыль), фильтры период/статус; ссылка из финансов и меню.
- **Редактирование работ**: `PUT /orders/lines/:id` — кол-во, цена, мастер без удаления; на completed сброс/перезаморозка ЗП; [`views/orders/show.ejs`](views/orders/show.ejs) карточки строк.
- **ЗП выплаты**: [`lib/payrollBalance.js`](lib/payrollBalance.js) — начислено/выплачено/остаток (период + всего); [`views/admin/payroll.ejs`](views/admin/payroll.ejs) история; admin с `payroll:mutate`.
- **Права admin**: `payroll:view`, `payroll:mutate`, `admin:reports` в [`config/permissions.js`](config/permissions.js).
- **Новый заказ**: поиск по госномеру (карточки результатов, баннер выбранного авто, блок «новый клиент»); [`views/orders/form.ejs`](views/orders/form.ejs).

### Key files
- `controllers/orderEconomicsController.js`, `controllers/orderController.js`, `controllers/payrollController.js`
- `lib/orderEconomics.js`, `lib/payrollBalance.js`
- `tests/order-economics.test.js`, `tests/orders.test.js`, `tests/payroll-finance.test.js`

### Verify
```bash
npm rebuild better-sqlite3   # при NODE_MODULE_VERSION mismatch
npm test
```

### Risks
- Редактирование закрытого заказа пересчитывает frozen ЗП — нужен аудит в проде.
- Остаток ЗП = начислено по completed − все payouts (без привязки payout к заказу).

---

## 2026-06-02 — Финансы (логика + UX) и мобильная навигация

### What changed
- **ЗП**: `computeOrderPayrollAmount` — оценка на открытых заказах; backfill `freezeOrderEarned` на закрытых без earned; пересчёт при добавлении строки в completed.
- **P&L**: `loadFinanceMetrics` — прибыль = выручка − расходники заказов − ЗП − прочие расходы (без двойного учёта materials в expenses).
- **Финансы UI**: 4 KPI, водопад, карточки заказов, период Сегодня/Неделя/Месяц ([`views/admin/finance.ejs`](views/admin/finance.ejs)).
- **Заказ mobile**: чипы статуса, аккордеон, полоска экономики, FAB, быстрый расходник ([`views/orders/show.ejs`](views/orders/show.ejs)).
- **Нижнее меню**: [`views/partials/mobile-nav.ejs`](views/partials/mobile-nav.ejs) (мастер vs owner).
- **Списки**: карточки заказов на узком экране; подсказка свайпа на расписании.

### Verify
```bash
npm test
```

---

## 2026-06-02 — Заказы: NaN fix, мастера UI, мобильная, PWA, экономика

### What changed
- **fix(addLine)**: `parseOptionalId` / `parseMasterIds` — PostgreSQL больше не получает `NaN` в `INTEGER` (`catalog_item_id`, `master_id`, `labor_minutes`).
- **Мастера на работе**: чекбоксы в [`views/orders/show.ejs`](views/orders/show.ejs); при N мастерах — N строк с делением суммы; имена в таблице; записи в `order_line_payroll`.
- **Миграция** `008_order_line_payroll.sql` (sqlite + postgres); [`lib/payroll.js`](lib/payroll.js) начисляет ЗП по строкам payroll.
- **Экономика заказа**: [`lib/orderEconomics.js`](lib/orderEconomics.js) — блок на заказе для owner/admin; таблица на [`/admin/finance`](views/admin/finance.ejs).
- **Роли**: мастер не видит «Экономику», закупку товаров; только свои работы в списке.
- **Мобильная**: `.table-scroll`, card-таблицы, touch-friendly чекбоксы в [`public/css/autoservice.css`](public/css/autoservice.css).
- **PWA**: [`public/sw.js`](public/sw.js) (кэш `autoservice-v2`), PNG иконки (`node scripts/generate-pwa-icons.js`), meta iOS, [`docs/PWA_INSTALL.md`](docs/PWA_INSTALL.md).

### Verify
```bash
npm rebuild better-sqlite3   # при смене Node
npm test
node scripts/generate-pwa-icons.js
```

### Risks
- Прибыль на заказе — упрощённая формула (выручка − расходники − ЗП), налог показан отдельно.
- Старые строки без `order_line_payroll` — расчёт ЗП по `order_lines.master_id` как раньше.

---

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

---

### What changed (2026-06-14)
- Карточка заказа: поля **Начало** / **Окончание** в блоке «Детали заказа»; предупреждение и строка в шапке, если время не задано.
- Порядок секций: шапка → авто/клиент (если нет авто) → детали → работы → товары → комментарий/фото → оплата.
- `update`: можно сохранить расписание для заказа без типа работ; сброс типа у заказа с типом по-прежнему даёт `work_type_error`.

### Key files
- `views/orders/show.ejs`, `controllers/orderController.js`, `public/css/autoservice.css`, `tests/orders.test.js`

### Verify
```bash
npm test
```

---

### What changed (2026-06-14 catalog material tiers)
- Каталог (мойка): для каждой категории авто (1/2/3) — отдельное поле **расходник** рядом с ценой.
- При добавлении работы в заказ расходник подставляется по выбранной категории (`materialForVehicleTier`).
- Миграция **022**: `material_cost_tier_2`, `material_cost_tier_3` в `catalog_items`.

### Key files
- `migrations/022_catalog_material_tiers.sql`, `lib/catalogPricing.js`, `views/catalog/form.ejs`
- `public/js/catalog-autocomplete.js`, `controllers/orderController.js`, `tests/catalog-pricing.test.js`

### Verify
```bash
npm test
```

### Railway
Если автомиграция не сработала: `docs/MIGRATE_POSTGRES_RAILWAY_022.sql`
