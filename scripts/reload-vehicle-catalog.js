const path = require("node:path");

const { getDB, resetDB } = require("../config/database");
const { applyMigrations } = require("../config/migrations");
const { syncFromSeed } = require("../lib/autoruCatalog");
const { syncFromCarsBase } = require("../lib/carsBaseCatalog");

async function clearVehicleCatalog(db) {
  const dialect = db.dialect || "sqlite";
  if (dialect === "postgres") {
    await db.exec(
      "TRUNCATE vehicle_generations, vehicle_models, vehicle_marks RESTART IDENTITY CASCADE"
    );
    return;
  }
  await db.exec(`
    DELETE FROM vehicle_generations;
    DELETE FROM vehicle_models;
    DELETE FROM vehicle_marks;
  `);
}

async function reloadVehicleCatalog(db, log) {
  await clearVehicleCatalog(db);
  if (log) log("Старый справочник марок/моделей удалён");

  let stats = await syncFromCarsBase(db, log);
  let source = "carsbase";
  if (stats.marks === 0) {
    if (log) log("cars-base недоступен — загрузка из локального seed…");
    stats = await syncFromSeed(db, log);
    source = "seed";
  }
  return { source, ...stats };
}

async function main() {
  if (!process.env.SQLITE_PATH && !process.env.DATABASE_URL) {
    process.env.SQLITE_PATH = path.join(__dirname, "..", "data", "autoservice.sqlite3");
  }

  resetDB();
  const db = await getDB();
  await applyMigrations(db);

  const log = (msg) => console.log("[reload-vehicles]", msg);
  log("Перезагрузка справочника авто…");

  const stats = await reloadVehicleCatalog(db, log);
  log(`Готово (${stats.source}): ${stats.marks} марок, ${stats.models} моделей`);

  await db.close();
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { clearVehicleCatalog, reloadVehicleCatalog };
