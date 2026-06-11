/**
 * Собирает docs/MIGRATE_SQLITE_FULL.sql из migrations/*.sql (без postgres/)
 * Запуск: node scripts/build-sqlite-full-migration.js
 */
const fs = require("node:fs");
const path = require("node:path");

const dir = path.join(__dirname, "..", "migrations");
const out = path.join(__dirname, "..", "docs", "MIGRATE_SQLITE_FULL.sql");

const files = fs
  .readdirSync(dir)
  .filter((f) => /^\d+_.+\.sql$/i.test(f))
  .sort();

const header = `-- =============================================================================
-- AUTOSERVICE CRM — полная миграция SQLite (${files[0]} … ${files[files.length - 1]})
-- =============================================================================
-- Назначение: развернуть схему на пустой базе SQLite (локально, тесты).
--
-- ВАЖНО:
-- 1) Выполняйте ОДИН раз на пустой файле БД (или удалите autoservice.sqlite3).
-- 2) Блок в конце создаёт таблицу migrations и помечает все файлы как применённые.
-- 3) Только схема — без бизнес-данных. Карточки каталога: npm run setup:db
-- 4) Обычно достаточно npm run migrate — этот файл для ручного sqlite3 / DBeaver.
--
-- Подключение:
--   sqlite3 data/autoservice.sqlite3 < docs/MIGRATE_SQLITE_FULL.sql
--
-- Порядок:
${files.map((f) => `--   ${f}`).join("\n")}
-- =============================================================================

PRAGMA foreign_keys = ON;

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
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;
for (const f of files) {
  body += `INSERT OR IGNORE INTO migrations(id) VALUES ('${f}');\n`;
}

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, header + body, "utf8");
// eslint-disable-next-line no-console
console.log(`Wrote ${out} (${files.length} migrations)`);
