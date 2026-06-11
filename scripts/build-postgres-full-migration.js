/**
 * Собирает docs/MIGRATE_POSTGRES_FULL.sql из migrations/postgres/*.sql
 * Запуск: node scripts/build-postgres-full-migration.js
 */
const fs = require("node:fs");
const path = require("node:path");

const dir = path.join(__dirname, "..", "migrations", "postgres");
const out = path.join(__dirname, "..", "docs", "MIGRATE_POSTGRES_FULL.sql");

const files = fs
  .readdirSync(dir)
  .filter((f) => /^\d+_.+\.sql$/i.test(f))
  .sort();

const header = `-- =============================================================================
-- AUTOSERVICE CRM — полная миграция PostgreSQL (${files[0]} … ${files[files.length - 1]})
-- =============================================================================
-- Назначение: развернуть схему на пустой БД (Railway, VPS, локальный Postgres).
--
-- ВАЖНО:
-- 1) Выполняйте ОДИН раз на пустой базе (или после DROP SCHEMA public CASCADE; CREATE SCHEMA public;).
-- 2) Блок в конце создаёт таблицу migrations и помечает все файлы как применённые —
--    иначе при старте приложение попытается выполнить те же ALTER повторно.
-- 3) Только схема — без клиентов, заказов и прочих бизнес-данных.
--    Старый учёт из «Учет - Лист1 (1).csv» сюда НЕ входит; при необходимости:
--      npm run import:uchet -- "Учет - Лист1 (1).csv"
--    Прайс: npm run import:price-sheet -- "Прайс от 12.2025 - Лист1.csv"
-- 4) На Railway обычно хватает переменной DATABASE_URL: applyMigrations() при boot.
--    Этот файл — для ручного psql, DBeaver, дампа схемы, аварийного восстановления.
--
-- Подключение:
--   psql "%DATABASE_URL%" -f docs/MIGRATE_POSTGRES_FULL.sql
--   (Windows cmd) или psql $env:DATABASE_URL -f docs/MIGRATE_POSTGRES_FULL.sql (PowerShell)
--
-- Порядок:
${files.map((f) => `--   ${f}`).join("\n")}
-- =============================================================================

`;

let body = "";
for (const f of files) {
  body += `\n-- ---------- ${f} ----------\n`;
  body += `${fs.readFileSync(path.join(dir, f), "utf8").trim()}\n`;
}

body += `
-- ---------- migrations registry (после ручного прогона) ----------
CREATE TABLE IF NOT EXISTS migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')
);
`;
for (const f of files) {
  body += `INSERT INTO migrations(id) VALUES ('${f}') ON CONFLICT (id) DO NOTHING;\n`;
}

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, header + body, "utf8");
// eslint-disable-next-line no-console
console.log(`Wrote ${out} (${files.length} migrations)`);
