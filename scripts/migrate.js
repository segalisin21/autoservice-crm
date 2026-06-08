const { getDB } = require("../config/database");
const { applyMigrations } = require("../config/migrations");
const { ensureVehicleCatalog } = require("../lib/autoruCatalog");

async function main() {
  const db = await getDB();
  await applyMigrations(db);
  await ensureVehicleCatalog(db, (msg) => {
    // eslint-disable-next-line no-console
    console.log("[vehicle-catalog]", msg);
  });
  await db.close();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});

