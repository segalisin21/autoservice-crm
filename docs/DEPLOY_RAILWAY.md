# Деплой на Railway + первичный импорт данных

Приложение — Node.js + Express + EJS.

**Хранилище на проде:**
- **PostgreSQL** (рекомендуется) — задайте `DATABASE_URL` из Railway Postgres plugin.
- **SQLite + Volume** — если `DATABASE_URL` не задан, используется `SQLITE_PATH` (нужен постоянный том).

---

## 0. Что уже готово в репозитории

- `railway.json` — стартовая команда `npm run start:prod`.
- `package.json` → `start:prod`: `migrate` → `import:uchet` (идемпотентно) → `seed:owner` → `node server.js`.
- Импортер `scripts/import-uchet-csv.js` **идемпотентен**: если в БД уже есть заказы — повторный импорт пропускается (дублей не будет).
- Путь к БД берётся из `SQLITE_PATH` (см. `config/database.js`), порт — из `PORT`.
- CSV `Учет - Лист1 (1).csv` лежит в корне репозитория и используется импортером по умолчанию.

---

## 1. Подготовка репозитория

1. Закоммить и запушить проект (включая CSV-файл `Учет - Лист1 (1).csv` — он не в `.gitignore`).
2. Убедись, что `data/` и `*.sqlite3` в `.gitignore` (локальная БД в репозиторий не попадает).

```bash
git add .
git commit -m "chore(deploy): railway config + idempotent import"
git push
```

---

## 2. Создание проекта на Railway

### Вариант А — через дашборд (проще)
1. https://railway.app → **New Project** → **Deploy from GitHub repo** → выбрать репозиторий.
2. Railway определит Node (Nixpacks), соберёт и запустит. `postinstall` сам соберёт `better-sqlite3` под Linux.

### Вариант Б — через CLI
```bash
npm i -g @railway/cli
railway login
railway init           # создать проект
railway up             # задеплоить текущую папку
```

---

## 3. PostgreSQL (рекомендуется)

1. В проекте Railway: **+ New → Database → PostgreSQL**.
2. В сервисе **autoservice-crm** → **Variables** → **Add Reference** → `DATABASE_URL` из Postgres.
3. Удалите `SQLITE_PATH`, если был — для Postgres он не нужен.
4. Сессии сохраняются в таблице `session` (создаётся автоматически через `connect-pg-simple`).

| Переменная | Значение |
|---|---|
| `DATABASE_URL` | reference `${{Postgres.DATABASE_URL}}` |
| `SESSION_SECRET` | длинная случайная строка |
| `NODE_ENV` | `production` |
| `OWNER_USERNAME` | напр. `owner` |
| `OWNER_PASSWORD` | надёжный пароль |

Volume **не нужен**.

---

## 4. SQLite + Volume (альтернатива)

SQLite-файл должен жить на томе, иначе данные сотрутся при каждом редеплое.

1. В сервисе → вкладка **Volumes** → **New Volume**.
2. Mount path: `/data`.
3. Сохранить (сервис перезапустится).

---

## 5. Переменные окружения (SQLite)

Добавь в сервисе (Variables):

| Переменная | Значение | Назначение |
|---|---|---|
| `SQLITE_PATH` | `/data/app.sqlite3` | файл БД на томе |
| `SESSION_SECRET` | длинная случайная строка | подпись сессий |
| `NODE_ENV` | `production` | secure-cookie и пр. |
| `OWNER_USERNAME` | напр. `owner` | создаётся служебный владелец |
| `OWNER_PASSWORD` | надёжный пароль | пароль владельца |
| `IMPORT_CSV` | (необязательно) путь к CSV | по умолчанию корневой `Учет - Лист1 (1).csv` |

`PORT` Railway выставляет сам — менять не нужно.

> Если `SESSION_SECRET` не задать, используется небезопасный дефолт — на проде обязательно задать.

---

## 6. Первый запуск

При старте `npm run start:prod` выполнит по порядку:
1. `migrate` — создаст схему на томе (`/data/app.sqlite3`);
2. `import:uchet` — если заказов ещё нет, зальёт данные из CSV (266 заказов, 648 строк, мастера, каталог); при повторных деплоях — пропустит;
3. `seed:owner` — создаст/обновит вход владельца из `OWNER_USERNAME`/`OWNER_PASSWORD`;
4. `node server.js` — поднимет сервер.

Открой выданный Railway домен (вкладка **Settings → Networking → Generate Domain**) и зайди под `owner` / своим паролем, либо под `vitalik` (владелец из таблицы, пароль `master` — **смени после входа**).

---

## 6. Логины после импорта

| Логин | Роль | Пароль | Кто |
|---|---|---|---|
| `vitalik` | owner | `master` | Виталик (владелец, из таблицы) |
| `owner` | owner | из `OWNER_PASSWORD` | служебный администратор |
| `master_1` | master | `master` | Савва |
| `master_2` | master | `master` | Борис |
| `master_3` | master | `master` | Богдан |
| `master_5` | master | `master` | олег |

> Пароли мастеров одинаковые (`master`) — раздай и попроси сменить, либо смени в разделе «Сотрудники».

---

## 7. Повторный/ручной импорт (если нужно)

Импорт идемпотентен: на непустой БД он ничего не делает. Чтобы **перезалить с нуля** на проде:

1. Подключиться к контейнеру (Railway → service → **⋯ → Shell**) или временно сменить Start Command.
2. Удалить файл БД на томе и перезапустить:
   ```bash
   rm -f /data/app.sqlite3 /data/app.sqlite3-wal /data/app.sqlite3-shm
   ```
3. Редеплой/рестарт — `start:prod` создаст БД и импортирует заново.

Локально то же самое:
```bash
# Windows PowerShell
Remove-Item data\dev.sqlite3* -ErrorAction SilentlyContinue
npm run import:uchet -- "Учет - Лист1 (1).csv"
node scripts/seed-owner.js --username owner --password owner
```

---

## 8. Обновление новой версии CSV

1. Заменить файл `Учет - Лист1 (1).csv` в репозитории, запушить.
2. Так как импорт идемпотентен, для заливки новых данных нужно очистить БД (см. п.7) — текущий импортер не делает инкрементального обновления (только первичная заливка).

---

## 9. Проверка после деплоя

- `/` — календарь месяца со счётчиками заказов и выручкой.
- `/?mode=day&date=2026-01-05` — заказы по колонкам сотрудников.
- `/journal` — построчный журнал (как в таблице).
- `/admin/finance` — касса/выручка/расходы/прибыль.
- `/expenses`, `/admin/payroll`, `/admin/users` — расходы, ЗП, сотрудники.
- Добавление на телефон (PWA): см. [docs/PWA_INSTALL.md](PWA_INSTALL.md).
