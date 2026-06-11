const path = require("node:path");

const { getDB } = require("../config/database");
const { applyMigrations } = require("../config/migrations");
const { suggestNextArticle } = require("../lib/catalogArticle");
const { readUchetCsv, collectCatalogItems } = require("../lib/uchetCsv");

async function upsertCatalog(db, items) {
  let upserted = 0;
  for (const item of items) {
    const existing = await db.query(
      `SELECT id FROM catalog_items WHERE type = ? AND category = ? AND name = ? LIMIT 1`,
      [item.type, item.category, item.name]
    );
    if (existing[0]) {
      await db.query(`UPDATE catalog_items SET default_price = ? WHERE id = ?`, [item.default_price, existing[0].id]);
    } else {
      const article = await suggestNextArticle(db, item.type);
      await db.query(
        `INSERT INTO catalog_items(type, category, name, article, default_price, unit, is_active) VALUES (?, ?, ?, ?, ?, 'шт', 1)`,
        [item.type, item.category, item.name, article, item.default_price]
      );
    }
    upserted += 1;
  }
  return upserted;
}

async function main() {
  const csvPath =
    process.argv.find((a) => a.endsWith(".csv")) ||
    process.env.IMPORT_CSV ||
    path.join(__dirname, "..", "Учет - Лист1 (1).csv");

  if (!process.env.SQLITE_PATH && !process.env.DATABASE_URL) {
    process.env.SQLITE_PATH = path.join(__dirname, "..", "data", "autoservice.sqlite3");
  }

  const db = await getDB();
  await applyMigrations(db);

  const fs = require("node:fs");
  if (!fs.existsSync(csvPath)) {
    // eslint-disable-next-line no-console
    console.error(`CSV not found: ${csvPath}`);
    process.exit(1);
  }

  const rows = readUchetCsv(csvPath);
  const items = collectCatalogItems(rows);
  const count = await upsertCatalog(db, items);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, csvPath, catalog_items: count }));
  await db.close();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
