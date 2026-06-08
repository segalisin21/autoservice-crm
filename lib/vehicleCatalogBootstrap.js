let bootstrapPromise = null;

async function bootstrapVehicleCatalog(log) {
  if (bootstrapPromise) return bootstrapPromise;

  const write =
    log ||
    ((msg) => {
      // eslint-disable-next-line no-console
      console.log("[vehicle-catalog]", msg);
    });

  bootstrapPromise = (async () => {
    const { getDB } = require("../config/database");
    const { applyMigrations } = require("../config/migrations");
    const { ensureVehicleCatalog } = require("./autoruCatalog");

    const db = await getDB();
    try {
      await applyMigrations(db);
      return await ensureVehicleCatalog(db, write);
    } finally {
      await db.close();
    }
  })().catch((err) => {
    bootstrapPromise = null;
    // eslint-disable-next-line no-console
    console.error("[vehicle-catalog] bootstrap failed:", err);
    return { seeded: false, error: err.message };
  });

  return bootstrapPromise;
}

module.exports = { bootstrapVehicleCatalog };
