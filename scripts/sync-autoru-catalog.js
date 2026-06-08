const path = require("node:path");

const { getDB, resetDB } = require("../config/database");
const { applyMigrations } = require("../config/migrations");
const { syncAll } = require("../lib/autoruCatalog");

async function main() {
  const args = process.argv.slice(2);
  const maxMarks = args.includes("--quick") ? 30 : Number(process.env.SYNC_MAX_MARKS || 0);
  const includeGenerations = args.includes("--generations");

  if (!process.env.SQLITE_PATH && !process.env.DATABASE_URL) {
    process.env.SQLITE_PATH = path.join(__dirname, "..", "data", "autoservice.sqlite3");
  }

  resetDB();
  const db = await getDB();
  await applyMigrations(db);

  // eslint-disable-next-line no-console
  console.log("Syncing vehicle catalog from Auto.ru…");
  const stats = await syncAll(db, {
    maxMarks,
    includeGenerations,
    log: (msg) => console.log(msg)
  });
  // eslint-disable-next-line no-console
  console.log("Done:", stats);
  await db.close();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
