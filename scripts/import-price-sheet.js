const path = require("node:path");

const { getDB } = require("../config/database");
const { applyMigrations } = require("../config/migrations");
const { defaultPriceSheetPath, importPriceSheet, readPriceSheetCsv } = require("../lib/importPriceSheet");

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const csvPath =
    process.argv.find((a) => a.endsWith(".csv")) ||
    defaultPriceSheetPath();

  if (!process.env.SQLITE_PATH && !process.env.DATABASE_URL) {
    process.env.SQLITE_PATH = path.join(__dirname, "..", "data", "autoservice.sqlite3");
  }

  const db = await getDB();
  await applyMigrations(db);

  const items = readPriceSheetCsv(csvPath);
  console.log(`Parsed ${items.length} items from ${csvPath}`);

  if (dryRun) {
    for (const item of items) {
      console.log(
        JSON.stringify({
          category: item.category,
          name: item.name,
          default_price: item.default_price,
          price_tier_2: item.price_tier_2,
          price_tier_3: item.price_tier_3,
          description: item.description ? item.description.slice(0, 80) + "…" : null
        })
      );
    }
    await db.close();
    return;
  }

  const result = await importPriceSheet(db, csvPath);
  await db.close();
  console.log(`Done: created ${result.created}, updated ${result.updated}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
