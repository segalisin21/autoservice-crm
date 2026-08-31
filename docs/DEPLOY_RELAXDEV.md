# Деплой на RelaxDev

CRM: **Node.js backend** + **PostgreSQL** (аддон RelaxDev).

## Переменные окружения

| KEY | VALUE |
|-----|--------|
| `NODE_ENV` | `production` |
| `SESSION_SECRET` | случайная строка **≥ 32 символов** |
| `DATABASE_URL` | из панели PostgreSQL (автоподстановка) |
| `PGSSLMODE` | `disable` |
| `PORT` | `8080` (или порт платформы) |

Опционально при первом деплое на пустую БД:

| KEY | VALUE |
|-----|--------|
| `OWNER_USERNAME` | логин владельца |
| `OWNER_PASSWORD` | пароль владельца |

## Старт

```
npm run start:prod
```

Прогоняет миграции, импорт каталога, seed владельца (если нет), затем `node server.js`.

## База данных

1. Создать PostgreSQL в проекте RelaxDev.
2. Импорт дампа с Railway: **plain SQL** (`pg_dump --format=plain`), не custom/binary.
3. На Railway нужен **pg_dump 18+** (сервер PG 18).
4. На RelaxDev внутренний host **не** `127.0.0.1` — брать из вкладки «База данных».

## Проверка после деплоя

- `GET /health` → `{"status":"ok","db":"postgres"}`
- Логин с учётной записью из дампа
- Логи без `ECONNREFUSED` и `SSL connections`

## Redeploy

После изменения переменных или push в Git — **Redeploy** в панели RelaxDev.

## DNS

Кастомный домен (например `autoservice-crm.relaxdev.ru`) настраивается в панели проекта → Домены.
