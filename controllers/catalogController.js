const { getDB } = require("../config/database");
const { sqlNow } = require("../config/sqlDialect");
const { parseMoney } = require("../lib/money");
const { parseOptionalTierPrice, parseOptionalTierMaterial, parseOptionalPayrollFixed } = require("../lib/catalogPricing");
const {
  normalizeArticle,
  validateArticleFormat,
  findArticleConflict,
  suggestNextArticle
} = require("../lib/catalogArticle");
const { likePatternFolded, lcLike, foldSearchCase } = require("../lib/sqlSearch");

const PAGE_SIZE = 50;

function parseCatalogBody(body) {
  return {
    type: String(body.type ?? "work").trim(),
    category: String(body.category ?? "").trim(),
    name: String(body.name ?? "").trim(),
    article: normalizeArticle(body.article),
    description: String(body.description ?? "").trim() || null,
    default_price: parseMoney(body.default_price),
    price_tier_2: parseOptionalTierPrice(body.price_tier_2),
    price_tier_3: parseOptionalTierPrice(body.price_tier_3),
    default_material_cost: parseMoney(body.default_material_cost),
    material_cost_tier_2: parseOptionalTierMaterial(body.material_cost_tier_2),
    material_cost_tier_3: parseOptionalTierMaterial(body.material_cost_tier_3),
    payroll_fixed: parseOptionalPayrollFixed(body.payroll_fixed),
    unit: String(body.unit ?? "").trim(),
    sort_order: Number(body.sort_order) || 0,
    is_active: body.is_active === "0" || body.is_active === 0 ? 0 : 1
  };
}

function applyProductDefaults(data) {
  data.type = "product";
  if (!data.category) data.category = "Продажа";
  if (!data.unit) data.unit = "шт";
  data.description = null;
  data.price_tier_2 = null;
  data.price_tier_3 = null;
  data.material_cost_tier_2 = null;
  data.material_cost_tier_3 = null;
  data.payroll_fixed = null;
  return data;
}

function parseProductBody(body) {
  return applyProductDefaults(parseCatalogBody({ ...body, type: "product" }));
}

function validateCatalog(data) {
  if (!["work", "product"].includes(data.type)) return "Неверный тип";
  if (!data.category || data.category.length > 50) return "Укажите категорию";
  if (!data.name || data.name.length > 200) return "Укажите название";
  return null;
}

function validateProduct(data) {
  if (!data.name || data.name.length > 200) return "Укажите название";
  return null;
}

function editPathForItem(item) {
  if (item.type === "product") return `/catalog/products/${item.id}/edit`;
  return `/catalog/${item.id}/edit`;
}

async function validateCatalogArticle(db, data, excludeId = null) {
  const basic = data.type === "product" ? validateProduct(data) : validateCatalog(data);
  if (basic) return basic;
  const formatErr = validateArticleFormat(data.article);
  if (formatErr) return formatErr;
  const conflict = await findArticleConflict(db, data.article, excludeId);
  if (conflict) {
    return `Артикул уже занят: «${conflict.name}» — ${editPathForItem(conflict)}`;
  }
  return null;
}

function renderWorkForm(res, status, { item, error, user }) {
  return res.status(status).render("catalog/form", {
    item,
    error,
    user,
    extraScripts: ["/js/catalog-article-form.js"]
  });
}

function renderProductForm(res, status, { item, error, user }) {
  return res.status(status).render("catalog/product-form", {
    item,
    error,
    user,
    extraScripts: ["/js/catalog-article-form.js"]
  });
}

async function insertCatalogItem(db, data) {
  await db.query(
    `
    INSERT INTO catalog_items(
      type, category, name, name_lc, article, description,
      default_price, price_tier_2, price_tier_3, default_material_cost, material_cost_tier_2, material_cost_tier_3,
      payroll_fixed, unit, is_active, sort_order
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    [
      data.type,
      data.category,
      data.name,
      foldSearchCase(data.name),
      data.article,
      data.description,
      data.default_price,
      data.price_tier_2,
      data.price_tier_3,
      data.default_material_cost,
      data.material_cost_tier_2,
      data.material_cost_tier_3,
      data.payroll_fixed,
      data.unit,
      data.is_active,
      data.sort_order
    ]
  );
}

async function updateCatalogItem(db, id, data) {
  const now = sqlNow(db.dialect);
  await db.query(
    `
    UPDATE catalog_items SET
      type = ?, category = ?, name = ?, name_lc = ?, article = ?, description = ?,
      default_price = ?, price_tier_2 = ?, price_tier_3 = ?,
      default_material_cost = ?, material_cost_tier_2 = ?, material_cost_tier_3 = ?,
      payroll_fixed = ?, unit = ?, is_active = ?, sort_order = ?, updated_at = ${now}
    WHERE id = ?
  `,
    [
      data.type,
      data.category,
      data.name,
      foldSearchCase(data.name),
      data.article,
      data.description,
      data.default_price,
      data.price_tier_2,
      data.price_tier_3,
      data.default_material_cost,
      data.material_cost_tier_2,
      data.material_cost_tier_3,
      data.payroll_fixed,
      data.unit,
      data.is_active,
      data.sort_order,
      id
    ]
  );
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
    where.push(`(${lcLike("name_lc")} OR article LIKE ?)`);
    params.push(likePatternFolded(search), `%${search.toUpperCase()}%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const view = String(req.query.view ?? "table").trim() === "cards" ? "cards" : "table";

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
  if (req.query.type === "product") {
    return res.redirect("/catalog/products/new");
  }
  const db = await getDB();
  const article = await suggestNextArticle(db, "work");
  res.render("catalog/form", {
    item: { type: "work", is_active: 1, article },
    error: null,
    user: req.session.user,
    extraScripts: ["/js/catalog-article-form.js"]
  });
}

async function create(req, res) {
  const data = parseCatalogBody(req.body);
  if (data.type === "product") {
    return res.redirect("/catalog/products/new");
  }
  data.type = "work";
  const db = await getDB();
  const error = await validateCatalogArticle(db, data);
  if (error) {
    return renderWorkForm(res, 400, { item: data, error, user: req.session.user });
  }

  await insertCatalogItem(db, data);
  return res.redirect("/catalog");
}

async function showEdit(req, res) {
  const db = await getDB();
  const rows = await db.query("SELECT * FROM catalog_items WHERE id = ?", [Number(req.params.id)]);
  const item = rows[0];
  if (!item) return res.status(404).send("Not found");
  if (item.type === "product") {
    return res.redirect(`/catalog/products/${item.id}/edit`);
  }
  res.render("catalog/form", {
    item,
    error: null,
    user: req.session.user,
    extraScripts: ["/js/catalog-article-form.js"]
  });
}

async function update(req, res) {
  const id = Number(req.params.id);
  const data = parseCatalogBody(req.body);
  if (data.type === "product") {
    return res.redirect(`/catalog/products/${id}/edit`);
  }
  data.type = "work";
  const db = await getDB();
  const error = await validateCatalogArticle(db, data, id);
  if (error) {
    return renderWorkForm(res, 400, { item: { ...data, id }, error, user: req.session.user });
  }

  await updateCatalogItem(db, id, data);
  return res.redirect("/catalog");
}

async function showProductNew(req, res) {
  const db = await getDB();
  const article = await suggestNextArticle(db, "product");
  res.render("catalog/product-form", {
    item: { type: "product", category: "Продажа", unit: "шт", is_active: 1, article },
    error: null,
    user: req.session.user,
    extraScripts: ["/js/catalog-article-form.js"]
  });
}

async function createProduct(req, res) {
  const data = parseProductBody(req.body);
  const db = await getDB();
  const error = await validateCatalogArticle(db, data);
  if (error) {
    return renderProductForm(res, 400, { item: data, error, user: req.session.user });
  }

  await insertCatalogItem(db, data);
  return res.redirect("/catalog?type=product");
}

async function showProductEdit(req, res) {
  const db = await getDB();
  const rows = await db.query("SELECT * FROM catalog_items WHERE id = ?", [Number(req.params.id)]);
  const item = rows[0];
  if (!item || item.type !== "product") return res.status(404).send("Not found");
  res.render("catalog/product-form", {
    item,
    error: null,
    user: req.session.user,
    extraScripts: ["/js/catalog-article-form.js"]
  });
}

async function updateProduct(req, res) {
  const id = Number(req.params.id);
  const db = await getDB();
  const existing = await db.query("SELECT id, type FROM catalog_items WHERE id = ?", [id]);
  if (!existing[0] || existing[0].type !== "product") {
    return res.status(404).send("Not found");
  }

  const data = parseProductBody(req.body);
  const error = await validateCatalogArticle(db, data, id);
  if (error) {
    return renderProductForm(res, 400, { item: { ...data, id }, error, user: req.session.user });
  }

  await updateCatalogItem(db, id, data);
  return res.redirect("/catalog?type=product");
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
  const id = Number(req.params.id);
  try {
    await db.query("DELETE FROM catalog_items WHERE id = ?", [id]);
  } catch (err) {
    const msg = String(err.message || err);
    if (/FOREIGN KEY|RESTRICT|constraint/i.test(msg)) {
      return res.status(409).send("Нельзя удалить: позиция используется в заказах или настройках ЗП.");
    }
    throw err;
  }
  return res.redirect("/catalog");
}

module.exports = {
  list,
  showNew,
  create,
  showEdit,
  update,
  showProductNew,
  createProduct,
  showProductEdit,
  updateProduct,
  toggle,
  remove
};
