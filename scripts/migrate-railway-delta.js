/**
 * Дельта-миграция для Railway Postgres: все неприменённые migrations/postgres/*.sql + backfill *_lc.
 * Запуск на Railway (Shell) или локально с DATABASE_URL:
 *   npm run migrate:railway-delta
 *
 * Ручной SQL только для 021: docs/MIGRATE_POSTGRES_RAILWAY_021.sql
 */
const { getDB } = require("../config/database");
const { applyMigrations } = require("../config/migrations");
const { backfillSearchLc } = require("../lib/sqlSearch");

async function main() {
  const db = await getDB();
  if (db.dialect !== "postgres") {
    // eslint-disable-next-line no-console
    console.warn("migrate:railway-delta: DATABASE_URL не Postgres — выполняется обычный migrate + backfill.");
  }

  const before = await db.query("SELECT id FROM migrations ORDER BY id");
  const beforeSet = new Set(before.map((r) => r.id));

  await applyMigrations(db);
  await backfillSearchLc(db);

  const after = await db.query("SELECT id FROM migrations ORDER BY id");
  const applied = after.filter((r) => !beforeSet.has(r.id)).map((r) => r.id);

  // eslint-disable-next-line no-console
  console.log(applied.length ? `Applied: ${applied.join(", ")}` : "No new migrations (already up to date).");
  // eslint-disable-next-line no-console
  console.log("Backfill search_lc completed.");

  await db.close();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
