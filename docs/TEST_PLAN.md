# TEST PLAN — Белка Парк CRM

> Стратегия тестирования адаптирована под текущий стек проекта (Node.js + Express + sql.js).

## 1. Хард-гейт

```powershell
npm test
```

Что делает:
- npm-скрипт раскрывается в `node --test "tests/**/*.test.js"`.
- Запускает встроенный test runner Node.js (`node:test` / `node:assert`).
- HTTP-уровень тестируется через `supertest` поверх экспортированного из [server.js](../server.js) Express-приложения (`module.exports = { app, initDB }`).

Хард-гейт ОДИН: только `npm test`. Никакие другие раннеры (jest, mocha, vitest, pytest) в этом репо не вводим — это закреплено в [.cursor/rules/testing.mdc](../.cursor/rules/testing.mdc).

## 2. Структура тестовых файлов

```
tests/
├── smoke.test.js         — текущий минимальный набор
├── auth.test.js          — (план) login flow + role guards
├── clients.test.js       — (план) CRUD клиентов
├── bookings.test.js      — (план) create/update + конфликты + бонусы
├── analytics.test.js     — (план) защита от SQLi (BUG-002)
└── helpers/
    ├── agent.js          — supertest-агент с авто-логином
    └── db.js             — изоляция БД (см. п.4)
```

Имя теста — `*.test.js`. Помещаются в `tests/`, импортируются через `require('node:test')`, `require('node:assert/strict')`.

## 3. Уже покрыто (smoke + регрессии)

[tests/smoke.test.js](../tests/smoke.test.js) — **до импорта** `server.js` задаётся `process.env.DB_PATH` во временный каталог, чтобы не трогать `data/forest-park.db`.

1. `GET /login` → 200 и форма входа (regex по action).
2. `GET /` без сессии → 302 на `/login`.
3. `GET /clients` без сессии → 302 на `/login`.
4. `POST /login` с `wrong/wrong` → 200 и сообщение «Неверный логин или пароль».
5. Аналитика: некорректные строки дат не дают опасного `BETWEEN`.
6. `GET /clients/search` под сессией admin → JSON-массив (BUG-001).
7. `sanitizeBodyForLog` скрывает `password`.
8. `bookingController.update` отклоняет пересечение по времени (BUG-007).
9. `utils/workHours.js`: `hourList` / `slotCount` для `10:00`–`20:00` (BUG-005).
10. `formatClockFromTotalMinutes` — регрессия к BUG-006 (21:30 + 120 мин → `23:30`).
11. `getStats` с пустым диапазоном и с диапазоном, где есть брони (BUG-003).
12. `getDashboardGrid`: длина `hours` меняется при смене `work_end` в настройках.

`before(async () => { await initDB(); })` — инициализация БД до тестов.

## 4. Изоляция БД

Реализовано: [config/database.js](../config/database.js) читает путь через **`getDbPath()`** при каждом `initDB`/`saveDB`; в тестах до `require('../server')` задаётся `DB_PATH` на файл во временной директории.

## 5. Ключевые сценарии для расширения

### 5.1 Auth (auth.test.js)
- Успешный логин `admin/admin123` → 302 `/`, cookie сохранён.
- Логин неактивного пользователя → ошибка.
- Нет права `services:manage`: например логин под ролью без него → `GET /services` → 403.
- `POST /logout` → 302 `/login`, повторный `GET /` → 302 `/login`.

### 5.2 Clients (clients.test.js)
- `GET /clients/search?q=` (regression к [BUG-001](bugs/BUG-001.md)) — ожидаем JSON.
- POST без `full_name` → 400.
- Успешное создание + редирект на карточку.
- Удаление каскадно убирает брони клиента.

### 5.3 Bookings (bookings.test.js)
- Создание брони с одной услугой (беседка) — проверяем `bookings`, `booking_items`, `bonus_points`.
- Создание брони, конфликтующей по времени — 409 + сообщение.
- Создание мульти-услуги (беседка + лазертаг) — обе позиции в `booking_items`.
- (regression к [BUG-007](bugs/BUG-007.md)) `PUT /bookings/:id` с конфликтом — после фикса должен возвращать 409.
- `PATCH /:id/status` с невалидным статусом → 400.

### 5.4 Analytics (analytics.test.js)
- (regression к [BUG-002](bugs/BUG-002.md)) `GET /admin/reports?start_date=...' OR '1'='1` не возвращает все строки и не падает с SQL-ошибкой.
- CSV-экспорт `/admin/reports/export?format=csv&type=bookings` — `Content-Type: text/csv; charset=utf-8`, BOM присутствует, разделитель `;`.

### 5.5 Activity logs (logger.test.js)
- (regression к [BUG-004](bugs/BUG-004.md)) После создания пользователя — `activity_logs.details` НЕ содержит `"password":"..."`.

### 5.6 Settings
- POST `/admin/settings` с `bonus_percent=10` → следующий созданный booking начисляет 10%.

## 6. Хелперы

`tests/helpers/agent.js`:
```js
const request = require('supertest');
const { app } = require('../../server');

async function loggedAgent(username = 'admin', password = 'admin123') {
  const agent = request.agent(app);
  await agent.post('/login').type('form').send({ username, password });
  return agent;
}

module.exports = { loggedAgent };
```

`tests/helpers/db.js`:
```js
const path = require('path');
const fs = require('fs');
const os = require('os');

function isolateDb() {
  const tmp = path.join(os.tmpdir(), `fp-test-${process.pid}-${Date.now()}.db`);
  process.env.DB_PATH = tmp;
  return () => fs.rmSync(tmp, { force: true });
}

module.exports = { isolateDb };
```

(хелперы появятся вместе с правкой `config/database.js`, см. п.4)

## 7. Принципы

- **Минимальные диффы.** Тесты не должны требовать рефакторинга больше одного-двух файлов на этап.
- **Без таймеров.** Не используем `setTimeout` / `await sleep` — все ожидания должны быть детерминированы (DB-операции синхронные через sql.js).
- **Параметризация БД.** Не пишем в боевую `data/forest-park.db` из тестов.
- **Регрессия по каждому BUG.** Любой BUG-XXX из [docs/QA_REPORT.md](QA_REPORT.md) после фикса получает регрессионный тест.
- **Сообщения как контракт.** Если UX-сообщение на странице ошибки изменилось (см. [DESIGN.md](DESIGN.md), п. 11), обновляем тест и копирайт одновременно.

## 8. CI

Пока нет. Когда заведём (GitHub Actions / GitLab CI):

```yaml
# .github/workflows/test.yml (план)
name: test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm test
```
