const path = require("node:path");

const { suggestNextArticle } = require("./catalogArticle");
const { readPriceSheetCsv } = require("./priceSheetCsv");

function defaultPriceSheetPath() {
  return (
    process.env.IMPORT_PRICE_SHEET ||
    path.join(__dirname, "..", "Прайс от 12.2025 - Лист1.csv")
  );
}

async function upsertCatalogItem(db, item) {
  const existing = await db.query(
    `SELECT id FROM catalog_items WHERE type = ? AND category = ? AND name = ? LIMIT 1`,
    [item.type, item.category, item.name]
  );
  if (existing[0]) {
    await db.query(
      `
      UPDATE catalog_items SET
        default_price = ?, price_tier_2 = ?, price_tier_3 = ?,
        description = ?, is_active = 1
      WHERE id = ?
    `,
      [item.default_price, item.price_tier_2, item.price_tier_3, item.description, existing[0].id]
    );
    return { action: "updated", id: existing[0].id };
  }

  const article = await suggestNextArticle(db, item.type);
  await db.query(
    `
    INSERT INTO catalog_items(
      type, category, name, article, description,
      default_price, price_tier_2, price_tier_3, unit, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'усл.', 1)
  `,
    [
      item.type,
      item.category,
      item.name,
      article,
      item.description,
      item.default_price,
      item.price_tier_2,
      item.price_tier_3
    ]
  );
  return { action: "created" };
}

async function importPriceSheet(db, csvPath) {
  const items = readPriceSheetCsv(csvPath);
  let created = 0;
  let updated = 0;
  for (const item of items) {
    const result = await upsertCatalogItem(db, item);
    if (result.action === "created") created += 1;
    else updated += 1;
  }
  return { items: items.length, created, updated, csvPath };
}

module.exports = { defaultPriceSheetPath, importPriceSheet, upsertCatalogItem, readPriceSheetCsv };
