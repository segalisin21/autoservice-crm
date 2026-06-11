/**
 * Первичное заполнение каталога из CSV прайса (идемпотентно).
 * Пропускает импорт, если в catalog_items уже есть позиции.
 *
 * SKIP_CATALOG_SEED=1 — отключить на boot.
 * IMPORT_PRICE_SHEET — путь к CSV.
 */
const fs = require("node:fs");

const { getDB } = require("../config/database");
const { applyMigrations } = require("../config/migrations");
const { defaultPriceSheetPath, importPriceSheet } = require("../lib/importPriceSheet");

async function main() {
  if (process.env.SKIP_CATALOG_SEED === "1") {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ skipped: true, reason: "SKIP_CATALOG_SEED=1" }));
    return;
  }

  const csvPath =
    process.argv.find((a) => a.endsWith(".csv")) ||
    defaultPriceSheetPath();

  const db = await getDB();
  await applyMigrations(db);
  const existing = await db.query("SELECT COUNT(*) AS c FROM catalog_items");
  const count = Number(existing[0]?.c ?? 0);

  if (count > 0) {
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({ skipped: true, reason: "catalog already has items", catalogItems: count })
    );
    await db.close();
    return;
  }

  if (!fs.existsSync(csvPath)) {
    // eslint-disable-next-line no-console
    console.warn(`seed-catalog: CSV not found, skipping: ${csvPath}`);
    await db.close();
    return;
  }

  const result = await importPriceSheet(db, csvPath);
  await db.close();
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify({
      seeded: true,
      csvPath: result.csvPath,
      catalogItems: result.items,
      created: result.created,
      updated: result.updated
    })
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err.message || err);
  process.exit(1);
});
