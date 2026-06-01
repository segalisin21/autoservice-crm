# RUNBOOK — деплой и эксплуатация Белка Парк CRM

Краткая памятка для одного администратора (см. [VPS_PROJECT.md](VPS_PROJECT.md)). Детали стека — [REPORT.md](REPORT.md).

## 1. Переменные окружения

Скопируйте [.env.example](../.env.example) в `.env` на сервере и задайте:

| Переменная | Обязательность | Заметка |
|------------|----------------|---------|
| `NODE_ENV` | production: **да** | Включает `secure` cookie, `trust proxy`, скрывает подсказки логина. |
| `SESSION_SECRET` | production: **да**, ≥32 символов | Без этого процесс завершится при старте. |
| `POSTGRES_*` | при Docker Postgres | См. `docker-compose.yml`. |
| `DATABASE_URL` | после миграции кода на `pg` | См. [POSTGRES_MIGRATION.md](POSTGRES_MIGRATION.md). |
| `PORT` | нет | Порт процесса Node; по умолчанию `3000`. **Railway / Render** и др. подставляют свой `PORT` — приложение слушает его автоматически (`server.js`). |

## 1.1 Railway / PaaS (Dockerfile)

- **Variables (Railway → сервис приложения):** `NODE_ENV=production`; **`SESSION_SECRET` ≥32 символов** (иначе `FATAL` при старте) — например `openssl rand -base64 32`; **`DATABASE_URL`** — ссылка на Postgres из плагина БД, если используете PostgreSQL.
- **`PORT`** задаёт платформа — не переопределяйте без нужды.
- При заданном **`DATABASE_URL`** сессии хранятся в таблице **`user_sessions`** (создаётся при старте через `connect-pg-simple`); без URL — MemoryStore (только для dev / один процесс).
- Сборка идёт из корневого [`Dockerfile`](../Dockerfile): `npm ci` требует **`package-lock.json`** в образе (копируется вместе с `package.json`).
- БД sql.js: при отсутствии постоянного тома данные могут сбрасываться при redeploy — при необходимости подключите **Volume** к каталогу с файлом БД (см. `DB_PATH` в [config/database.js](../config/database.js), по умолчанию `data/forest-park.db`).

## 2. TLS (рекомендуется Caddy)

Пример конфига: [deploy/Caddyfile.example](../deploy/Caddyfile.example). Caddy на хосте слушает `:443`, проксирует на `127.0.0.1:3000` (или на контейнер приложения).

Альтернатива: nginx + certbot по стандартным инструкциям Let’s Encrypt.

## 3. Деплой на VPS (Docker)

**Предпосылки:** Ubuntu/Debian с установленными Docker Engine и Docker Compose v2; домен указывает A-записью на IP VPS; порты 80/443 свободны (для Caddy).

1. На сервере: `git clone …` в каталог проекта (или `git pull` при обновлении).
2. `cp .env.example .env` и отредактируйте `.env`: обязательно **`SESSION_SECRET`** (≥32 символов), **`NODE_ENV=production`**, **`POSTGRES_PASSWORD`** (если поднимаете сервис `postgres`). Файл `.env` не коммитить; права `chmod 600 .env`.
3. Сборка и запуск только приложения (sql.js, БД в volume `db-data`):

   ```bash
   docker compose up -d forest-park-crm
   ```

   Сервис `postgres` в compose нужен для `npm run verify-pg` и будущей миграции приложения на `pg`; **текущее приложение его не использует**. Его можно не поднимать, пока не перейдёте на PostgreSQL.

4. TLS: установите [Caddy](https://caddyserver.com/docs/install) на хосте, скопируйте [deploy/Caddyfile.example](../deploy/Caddyfile.example), подставьте свой домен, прокси на `127.0.0.1:3000` (порт приложения привязан к localhost на хосте — см. `docker-compose.yml`).
5. Проверка с VPS: `curl -fI http://127.0.0.1:3000/login` → `200`. Снаружи: `curl -fI https://ваш-домен/login` → `200` или редирект на логин.

**Локально без прокси:** если нужен доступ к контейнеру с другой машины в LAN, в `docker-compose.yml` временно замените привязку порта на `3000:3000`.

Откат: предыдущий образ/коммит + `docker compose up -d` + при необходимости восстановление файла БД из volume `db-data` (см. §4).

## 4. Бэкапы

- **Пока sql.js:** копия файла БД из volume `db-data` (`forest-park.db`) по cron.
- **После PostgreSQL:** ежедневный `pg_dump` в отдельный каталог + ротация (см. [VPS_PROJECT.md](VPS_PROJECT.md) §4.3).

Раз в квартал — пробное восстановление на тестовой VM.

## 5. Мониторинг

Минимум: внешний HTTP-check домена + алерт по диску/памяти (хостинг или Uptime Kuma self-hosted).

## 6. Логи

Docker: `docker compose logs -f forest-park-crm`. Ротация на хосте или у провайдера.
