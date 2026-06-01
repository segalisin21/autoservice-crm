# Миграция приложения с sql.js на PostgreSQL

Инфраструктура: в [docker-compose.yml](../docker-compose.yml) уже есть сервис `postgres` и [scripts/postgres/init.sql](../scripts/postgres/init.sql) (схема + начальные данные).

## Проверка доступности Postgres

После `docker compose up -d postgres` и настройки `.env`:

```powershell
npm install
npm run verify-pg
```

Скрипт читает `DATABASE_URL` (например `postgresql://forest:ПАРОЛЬ@localhost:5432/forestpark` с хоста при проброшенном порте).

## Что осталось сделать в коде

1. Добавить слой на **`pg`** (async): пул, `query`/`transaction`.
2. Заменить вызовы `getDB`/`prepare`/`exec` во всех [controllers/](../controllers/) и [routes/](../routes/) на async-API.
3. Переписать SQLite-специфику: `last_insert_rowid` → `RETURNING id`, `strftime` / `date('now', …)` → функции PostgreSQL, `datetime('now', 'start of month')` → `date_trunc`, и т.д.
4. В [docker-compose.yml](../docker-compose.yml) для сервиса `forest-park-crm` раскомментировать `environment: DATABASE_URL` и `depends_on: postgres` после готовности приложения.
5. Одноразовый перенос данных из `forest-park.db` в Postgres (отдельный скрипт или pgloader) — если нужна история, а не «чистый» старт.

До выполнения пунктов 1–4 приложение должно **не** получать `DATABASE_URL`, чтобы продолжало работать на sql.js.
