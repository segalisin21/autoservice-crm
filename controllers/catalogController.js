const { getDB } = require("../config/database");
const { sqlNow } = require("../config/sqlDialect");
const { parseMoney } = require("../lib/money");

const PAGE_SIZE = 50;

function parseCatalogBody(body) {
  return {
    type: String(body.type ?? "work").trim(),
    category: String(body.category ?? "").trim(),
    name: String(body.name ?? "").trim(),
    default_price: parseMoney(body.default_price),
    unit: String(body.unit ?? "").trim(),
    sort_order: Number(body.sort_order) || 0,
    is_active: body.is_active === "0" || body.is_active === 0 ? 0 : 1
  };
}

function validateCatalog(data) {
  if (!["work", "product"].includes(data.type)) return "Неверный тип";
  if (!data.category || data.category.length > 50) return "Укажите категорию";
  if (!data.name || data.name.length > 200) return "Укажите название";
  return null;
}

async function list(req, res) {
  const db = await getDB();
  const type = String(req.query.type ?? "").trim();
  const category = String(req.query.category ?? "").trim();
  const search = String(req.query.search ?? "").trim();
  const page = Math.max(1, Number(req.query.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const where = [];
  const params = [];
  if (type) {
    where.push("type = ?");
    params.push(type);
  }
  if (category) {
    where.push("category = ?");
    params.push(category);
  }
  if (search) {
    where.push("name LIKE ?");
    params.push(`%${search}%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const view = String(req.query.view ?? "cards").trim() === "table" ? "table" : "cards";

  const items = await db.query(
    `
    SELECT * FROM catalog_items
    ${whereSql}
    ORDER BY type, category, sort_order, name
    LIMIT ? OFFSET ?
  `,
    [...params, PAGE_SIZE, offset]
  );

  const categories = await db.query(
    "SELECT DISTINCT category, type FROM catalog_items ORDER BY type, category"
  );

  res.render("catalog/list", {
    items,
    categories,
    filters: { type, category, search, view },
    synced: req.query.synced === "1",
    syncSource: req.query.source || "",
    user: req.session.user
  });
}

async function showNew(req, res) {
  res.render("catalog/form", {
    item: { type: req.query.type || "work", is_active: 1 },
    error: null,
    user: req.session.user
  });
}

async function create(req, res) {
  const data = parseCatalogBody(req.body);
  const error = validateCatalog(data);
  if (error) {
    return res.status(400).render("catalog/form", { item: data, error, user: req.session.user });
  }

  const db = await getDB();
  await db.query(
    `
    INSERT INTO catalog_items(type, category, name, default_price, unit, is_active, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
    [data.type, data.category, data.name, data.default_price, data.unit, data.is_active, data.sort_order]
  );
  return res.redirect("/catalog");
}

async function showEdit(req, res) {
  const db = await getDB();
  const rows = await db.query("SELECT * FROM catalog_items WHERE id = ?", [Number(req.params.id)]);
  const item = rows[0];
  if (!item) return res.status(404).send("Not found");
  res.render("catalog/form", { item, error: null, user: req.session.user });
}

async function update(req, res) {
  const id = Number(req.params.id);
  const data = parseCatalogBody(req.body);
  const error = validateCatalog(data);
  if (error) {
    return res.status(400).render("catalog/form", { item: { ...data, id }, error, user: req.session.user });
  }

  const db = await getDB();
  const now = sqlNow(db.dialect);
  await db.query(
    `
    UPDATE catalog_items SET
      type = ?, category = ?, name = ?, default_price = ?, unit = ?,
      is_active = ?, sort_order = ?, updated_at = ${now}
    WHERE id = ?
  `,
    [data.type, data.category, data.name, data.default_price, data.unit, data.is_active, data.sort_order, id]
  );
  return res.redirect("/catalog");
}

async function toggle(req, res) {
  const db = await getDB();
  const id = Number(req.params.id);
  await db.query("UPDATE catalog_items SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END WHERE id = ?", [
    id
  ]);
  return res.redirect("/catalog");
}

async function remove(req, res) {
  const db = await getDB();
  await db.query("DELETE FROM catalog_items WHERE id = ?", [Number(req.params.id)]);
  return res.redirect("/catalog");
}

module.exports = { list, showNew, create, showEdit, update, toggle, remove };
