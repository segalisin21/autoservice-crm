# autoservice-crm

CRM для автосервиса: клиенты, автомобили, заказ-наряды, зарплата, финансы.

## Локальный запуск

```powershell
npm install
copy .env.example .env
npm start
```

Откройте http://localhost:3000

## Продакшен (Railway / Postgres)

1. Создайте PostgreSQL и подключите `DATABASE_URL`.
2. Задайте переменные окружения:
   - `SESSION_SECRET` — длинная случайная строка
   - `NODE_ENV=production`
   - `OWNER_USERNAME`, `OWNER_PASSWORD`, `OWNER_NAME` — первый владелец
3. Старт: `npm run start:prod` (миграции, импорт CSV, seed владельца, сервер).

Конфиг Railway: `railway.json`.

## Тесты

```powershell
npm test
```
