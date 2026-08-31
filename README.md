# autoservice-crm

CRM для автосервиса: клиенты, автомобили, заказ-наряды, зарплата, финансы.

## Локальный запуск

```powershell
npm install
copy .env.example .env
npm start
```

Откройте http://localhost:3000

## Продакшен (Railway / RelaxDev)

### RelaxDev (Россия)

См. [docs/DEPLOY_RELAXDEV.md](docs/DEPLOY_RELAXDEV.md).

Кратко:

- PostgreSQL addon + `DATABASE_URL`
- `PGSSLMODE=disable`
- `SESSION_SECRET` ≥ 32 символов
- `NODE_ENV=production`
- Старт: `npm run start:prod`

### Railway

1. В Railway: **New → Database → PostgreSQL**.
2. В сервисе приложения → **Variables** → добавить:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (reference из Postgres-сервиса)
   - `SESSION_SECRET` — длинная случайная строка
   - `NODE_ENV=production`
   - `OWNER_USERNAME`, `OWNER_PASSWORD`, `OWNER_NAME`
3. Volume для SQLite **не нужен**.
4. Старт: `npm run start:prod` — миграции Postgres, импорт CSV, seed владельца.

### Вариант B — SQLite на Volume

1. Volume mount path: `/data`
2. `SQLITE_PATH=/data/app.sqlite3`
3. Остальные переменные как выше (без `DATABASE_URL`)

Конфиг Railway: `railway.json`.

## Тесты

```powershell
npm test
```
