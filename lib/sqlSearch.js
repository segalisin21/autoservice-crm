function foldSearchCase(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("ru-RU");
}

function likePattern(q) {
  return `%${String(q ?? "").trim()}%`;
}

function likePatternFolded(q) {
  return `%${foldSearchCase(q)}%`;
}

function ciLike(columnSql) {
  return `LOWER(${columnSql}) LIKE LOWER(?)`;
}

function lcLike(columnSql) {
  return `${columnSql} LIKE ?`;
}

async function backfillSearchLc(db) {
  const { foldSearchCase: fold } = module.exports;

  const clients = await db.query(
    "SELECT id, full_name FROM clients WHERE full_name IS NOT NULL AND (full_name_lc IS NULL OR full_name_lc = '')"
  );
  for (const row of clients) {
    await db.query("UPDATE clients SET full_name_lc = ? WHERE id = ?", [fold(row.full_name), row.id]);
  }

  const items = await db.query(
    "SELECT id, name FROM catalog_items WHERE name IS NOT NULL AND (name_lc IS NULL OR name_lc = '')"
  );
  for (const row of items) {
    await db.query("UPDATE catalog_items SET name_lc = ? WHERE id = ?", [fold(row.name), row.id]);
  }

  const cars = await db.query(
    "SELECT id, make, model FROM cars WHERE (make IS NOT NULL AND (make_lc IS NULL OR make_lc = '')) OR (model IS NOT NULL AND (model_lc IS NULL OR model_lc = ''))"
  );
  for (const row of cars) {
    await db.query("UPDATE cars SET make_lc = ?, model_lc = ? WHERE id = ?", [
      row.make ? fold(row.make) : null,
      row.model ? fold(row.model) : null,
      row.id
    ]);
  }

  const lines = await db.query(
    "SELECT id, name FROM order_lines WHERE name IS NOT NULL AND (name_lc IS NULL OR name_lc = '')"
  );
  for (const row of lines) {
    await db.query("UPDATE order_lines SET name_lc = ? WHERE id = ?", [fold(row.name), row.id]);
  }
}

module.exports = {
  foldSearchCase,
  likePattern,
  likePatternFolded,
  ciLike,
  lcLike,
  backfillSearchLc
};
