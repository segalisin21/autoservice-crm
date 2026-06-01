const { getDB } = require("../config/database");
const { sqlNow } = require("../config/sqlDialect");
const { parseMoney } = require("../lib/money");
const { loadTaxSettings, ensureDefaultSettings } = require("../lib/settings");
const { recomputeOrderTotals, getPaidAmount } = require("../lib/orderTotals");
const { onOrderStatusChange } = require("../lib/payroll");
const { WORK_TYPES, normalizeWorkType, lineTypeForWorkType } = require("../lib/workTypes");
const { normalizePlate, normalizePhone, normalizeVin } = require("../lib/normalize");
const { relativePathFor, absolutePathFor } = require("../lib/upload");
const fs = require("node:fs");

function normalizeTime(value) {
  const s = String(value ?? "").trim();
  if (/^\d{2}:\d{2}$/.test(s)) return s;
  if (/^\d{1}:\d{2}$/.test(s)) return `0${s}`;
  return null;
}

function normalizeUserId(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const PAGE_SIZE = 50;
const ORDER_STATUSES = ["scheduled", "in_progress", "ready", "completed", "cancelled"];

async function loadMasters(db) {
  return db.query(
    "SELECT id, name, username FROM users WHERE role IN ('master','admin','owner') AND is_active = 1 ORDER BY name"
  );
}

async function loadCarsForSelect(db) {
  return db.query(
    `
    SELECT c.id, c.make, c.model, c.license_plate_raw, cl.full_name, cl.phone_raw
    FROM cars c
    JOIN clients cl ON cl.id = c.client_id
    ORDER BY cl.full_name
    LIMIT 500
  `
  );
}

async function getOrderContext(db, orderId) {
  const rows = await db.query(
    `
    SELECT o.*,
           c.make, c.model, c.license_plate_raw, c.vin,
           cl.id AS client_id, cl.full_name AS client_name, cl.phone_raw AS client_phone
    FROM orders o
    JOIN cars c ON c.id = o.car_id
    JOIN clients cl ON cl.id = c.client_id
    WHERE o.id = ?
  `,
    [orderId]
  );
  if (!rows.length) return null;
  const order = rows[0];
  const lines = await db.query("SELECT * FROM order_lines WHERE order_id = ? ORDER BY id", [orderId]);
  const works = lines.filter((l) => l.line_type === "work");
  const products = lines.filter((l) => l.line_type === "product");
  const paid_amount = await getPaidAmount(db, orderId);
  const due_amount = Math.max(0, parseMoney(order.total_price) - paid_amount);
  const payments = await db.query("SELECT * FROM payments WHERE order_id = ? ORDER BY paid_at DESC", [orderId]);
  return { order, works, products, paid_amount, due_amount, payments };
}

async function list(req, res) {
  const db = await getDB();
  const status = String(req.query.status ?? "").trim();
  const search = String(req.query.search ?? "").trim();
  const page = Math.max(1, Number(req.query.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const where = [];
  const params = [];
  if (status) {
    where.push("o.status = ?");
    params.push(status);
  }
  if (search) {
    where.push(
      "(cl.full_name LIKE ? OR cl.phone_normalized LIKE ? OR c.license_plate_normalized LIKE ? OR CAST(o.id AS TEXT) LIKE ?)"
    );
    const like = `%${search}%`;
    const digits = search.replace(/\D/g, "");
    params.push(like, `%${digits || search}%`, `%${search.toUpperCase().replace(/[\s-]/g, "")}%`, like);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const orders = await db.query(
    `
    SELECT o.id, o.opened_at, o.status, o.work_type, o.total_price,
           c.license_plate_raw, c.make AS car_make, cl.full_name AS client_name, cl.phone_raw AS client_phone
    FROM orders o
    JOIN cars c ON c.id = o.car_id
    JOIN clients cl ON cl.id = c.client_id
    ${whereSql}
    ORDER BY o.id DESC
    LIMIT ? OFFSET ?
  `,
    [...params, PAGE_SIZE, offset]
  );

  for (const o of orders) {
    o.paid_amount = await getPaidAmount(db, o.id);
    o.due_amount = Math.max(0, parseMoney(o.total_price) - o.paid_amount);
  }

  res.render("orders/list", {
    orders,
    filters: { status, search },
    statuses: ORDER_STATUSES,
    user: req.session.user
  });
}

async function findCarsByPlate(db, plateRaw) {
  const { license_plate_normalized } = normalizePlate(plateRaw);
  if (!license_plate_normalized) return [];
  return db.query(
    `
    SELECT c.id, c.make, c.model, c.year, c.license_plate_raw,
           cl.full_name AS client_name, cl.phone_raw AS client_phone
    FROM cars c
    JOIN clients cl ON cl.id = c.client_id
    WHERE c.license_plate_normalized LIKE ?
    ORDER BY c.id DESC
    LIMIT 25
  `,
    [`%${license_plate_normalized}%`]
  );
}

async function showNew(req, res) {
  const db = await getDB();
  const masters = await loadMasters(db);
  const today = new Date().toISOString().slice(0, 10);

  const plateQuery = String(req.query.plate ?? "").trim();
  let plateMatches = [];
  let selectedCarId = req.query.car_id || "";
  if (plateQuery) {
    plateMatches = await findCarsByPlate(db, plateQuery);
    if (plateMatches.length === 1) selectedCarId = String(plateMatches[0].id);
  }

  const cars = await loadCarsForSelect(db);
  res.render("orders/form", {
    order: {
      car_id: selectedCarId,
      status: "scheduled",
      work_type: "Электрика",
      scheduled_date: req.query.scheduled_date || today,
      assigned_user_id: req.query.assigned_user_id || "",
      start_time: req.query.start_time || "",
      end_time: req.query.end_time || ""
    },
    cars,
    masters,
    plateQuery,
    plateMatches,
    workTypes: WORK_TYPES,
    error: null,
    user: req.session.user,
    category: "orders"
  });
}

async function resolveOrCreateCar(db, body) {
  const existingId = Number(body.car_id);
  if (Number.isFinite(existingId) && existingId > 0) return existingId;

  const plate = normalizePlate(body.new_plate);
  const make = String(body.new_make ?? "").trim() || null;
  const model = String(body.new_model ?? "").trim() || null;
  const yearRaw = String(body.new_year ?? "").trim();
  const year = yearRaw && Number.isFinite(Number(yearRaw)) ? Number(yearRaw) : null;
  const vin = normalizeVin(body.new_vin);
  const ownerName = String(body.new_owner_name ?? "").trim();
  const { phone_raw, phone_normalized } = normalizePhone(body.new_owner_phone);

  const hasCarData = plate.license_plate_normalized || make || model;
  if (!hasCarData) return null;
  if (!ownerName || phone_normalized.length < 10) {
    return { error: "Для нового авто укажите ФИО владельца и телефон" };
  }

  const clientId = await db.insertReturning(
    `INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES (?, ?, ?)`,
    [ownerName, phone_raw, phone_normalized]
  );

  const carId = await db.insertReturning(
    `
    INSERT INTO cars(client_id, make, model, vin, license_plate_raw, license_plate_normalized, year)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
    [clientId, make, model, vin, plate.license_plate_raw, plate.license_plate_normalized, year]
  );
  return carId;
}

async function create(req, res) {
  const work_type = normalizeWorkType(req.body.work_type);
  const notes = String(req.body.notes ?? "").trim() || null;
  const scheduled_date = String(req.body.scheduled_date ?? "").slice(0, 10) || new Date().toISOString().slice(0, 10);
  const assigned_user_id = normalizeUserId(req.body.assigned_user_id);
  const start_time = normalizeTime(req.body.start_time);
  const end_time = normalizeTime(req.body.end_time);

  const db = await getDB();

  async function renderError(error) {
    const cars = await loadCarsForSelect(db);
    const masters = await loadMasters(db);
    return res.status(400).render("orders/form", {
      order: req.body,
      cars,
      masters,
      plateQuery: "",
      plateMatches: [],
      workTypes: WORK_TYPES,
      error,
      user: req.session.user,
      category: "orders"
    });
  }

  const resolved = await resolveOrCreateCar(db, req.body);
  if (resolved && typeof resolved === "object" && resolved.error) {
    return renderError(resolved.error);
  }
  const car_id = Number(resolved);
  if (!Number.isFinite(car_id) || car_id <= 0) {
    return renderError("Выберите автомобиль или заполните данные нового авто и владельца");
  }

  await ensureDefaultSettings(db);
  const tax = await loadTaxSettings(db);

  const orderId = await db.insertReturning(
    `
    INSERT INTO orders(
      car_id, status, work_type, notes, created_by,
      tax_enabled, tax_mode, tax_rate, prices_include_tax,
      scheduled_date, assigned_user_id, start_time, end_time
    ) VALUES (?, 'scheduled', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    [
      car_id,
      work_type,
      notes,
      req.session.user?.id || null,
      tax.tax_enabled,
      tax.tax_mode,
      tax.tax_rate,
      tax.prices_include_tax,
      scheduled_date,
      assigned_user_id,
      start_time,
      end_time
    ]
  );
  return res.redirect(`/orders/${orderId}`);
}

async function show(req, res) {
  const db = await getDB();
  const ctx = await getOrderContext(db, Number(req.params.id));
  if (!ctx) return res.status(404).send("Not found");

  const catalogWorks = await db.query(
    "SELECT id, name, default_price, unit FROM catalog_items WHERE type = 'work' AND is_active = 1 ORDER BY category, name LIMIT 200"
  );
  const catalogProducts = await db.query(
    "SELECT id, name, default_price, unit FROM catalog_items WHERE type = 'product' AND is_active = 1 ORDER BY category, name LIMIT 200"
  );
  const masters = await loadMasters(db);

  const photos = await db.query(
    "SELECT id, file_path, original_name FROM order_photos WHERE order_id = ? ORDER BY id DESC",
    [Number(req.params.id)]
  );

  res.render("orders/show", {
    ...ctx,
    catalogWorks,
    catalogProducts,
    masters,
    photos,
    statuses: ORDER_STATUSES,
    user: req.session.user,
    category: "orders"
  });
}

async function update(req, res) {
  const id = Number(req.params.id);
  const db = await getDB();
  const rows = await db.query("SELECT * FROM orders WHERE id = ?", [id]);
  if (!rows.length) return res.status(404).send("Not found");
  if (rows[0].status === "completed") {
    return res.redirect(`/orders/${id}`);
  }

  const previousStatus = rows[0].status;
  const work_type = normalizeWorkType(req.body.work_type || rows[0].work_type);
  const discount_type = String(req.body.discount_type ?? "none");
  const discount_value = parseMoney(req.body.discount_value);
  const discount_scope = String(req.body.discount_scope ?? "order_total");
  const notes = String(req.body.notes ?? "").trim() || null;
  const status = String(req.body.status ?? rows[0].status);
  const scheduled_date =
    String(req.body.scheduled_date ?? rows[0].scheduled_date ?? "").slice(0, 10) ||
    new Date().toISOString().slice(0, 10);
  const assigned_user_id = normalizeUserId(req.body.assigned_user_id);
  const start_time = normalizeTime(req.body.start_time);
  const end_time = normalizeTime(req.body.end_time);

  let closed_at = rows[0].closed_at;
  if (status === "completed" && !closed_at) {
    closed_at = new Date().toISOString().slice(0, 19).replace("T", " ");
  }

  const now = sqlNow(db.dialect);
  await db.query(
    `
    UPDATE orders SET
      discount_type = ?, discount_value = ?, discount_scope = ?,
      work_type = ?, notes = ?, status = ?, closed_at = ?,
      scheduled_date = ?, assigned_user_id = ?, start_time = ?, end_time = ?,
      updated_at = ${now}
    WHERE id = ?
  `,
    [
      discount_type,
      discount_value,
      discount_scope,
      work_type,
      notes,
      status,
      closed_at,
      scheduled_date,
      assigned_user_id,
      start_time,
      end_time,
      id
    ]
  );

  await recomputeOrderTotals(id);
  await onOrderStatusChange(id, previousStatus, status);
  return res.redirect(`/orders/${id}`);
}

async function changeStatus(req, res) {
  const id = Number(req.params.id);
  const status = String(req.body.status ?? "");
  if (!ORDER_STATUSES.includes(status)) {
    return res.redirect(`/orders/${id}`);
  }

  const db = await getDB();
  const rows = await db.query("SELECT status FROM orders WHERE id = ?", [id]);
  const previousStatus = rows[0]?.status;
  let closed_at = null;
  if (status === "completed") {
    closed_at = new Date().toISOString().slice(0, 19).replace("T", " ");
  }
  const now = sqlNow(db.dialect);
  await db.query(
    `UPDATE orders SET status = ?, closed_at = COALESCE(closed_at, ?), updated_at = ${now} WHERE id = ?`,
    [status, closed_at, id]
  );
  await onOrderStatusChange(id, previousStatus, status);
  return res.redirect(`/orders/${id}`);
}

async function addLine(req, res) {
  const orderId = Number(req.params.id);
  const db = await getDB();
  const orders = await db.query("SELECT work_type FROM orders WHERE id = ?", [orderId]);
  const defaultLineType = lineTypeForWorkType(orders[0]?.work_type);
  let line_type = String(req.body.line_type ?? defaultLineType);

  const catalogId = req.body.catalog_item_id ? Number(req.body.catalog_item_id) : null;
  let name = String(req.body.name ?? "").trim();
  let unit_price = parseMoney(req.body.unit_price);
  const quantity = parseMoney(req.body.quantity) || 1;

  if (catalogId) {
    const cat = await db.query("SELECT name, default_price, type FROM catalog_items WHERE id = ?", [catalogId]);
    if (cat[0]) {
      name = cat[0].name;
      if (!req.body.unit_price) unit_price = parseMoney(cat[0].default_price);
      if (cat[0].type !== line_type) line_type = cat[0].type;
    }
  }
  if (!name) return res.redirect(`/orders/${orderId}`);

  const master_id = req.body.master_id ? Number(req.body.master_id) : null;
  const labor_minutes = req.body.labor_minutes ? Number(req.body.labor_minutes) : null;
  const cost_price = line_type === "product" ? parseMoney(req.body.cost_price) : 0;
  const lineTotal = parseMoney(quantity * unit_price);

  await db.query(
    `
    INSERT INTO order_lines(
      order_id, line_type, catalog_item_id, name, quantity, unit_price, total,
      master_id, work_status, labor_minutes, cost_price
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    [
      orderId,
      line_type,
      catalogId,
      name,
      quantity,
      unit_price,
      lineTotal,
      line_type === "work" ? master_id : null,
      line_type === "work" ? "pending" : null,
      line_type === "work" ? labor_minutes : null,
      cost_price
    ]
  );

  await recomputeOrderTotals(orderId);
  return res.redirect(`/orders/${orderId}`);
}

async function updateLine(req, res) {
  const lineId = Number(req.params.lineId);
  const db = await getDB();
  const lines = await db.query("SELECT * FROM order_lines WHERE id = ?", [lineId]);
  const line = lines[0];
  if (!line) return res.status(404).send("Not found");

  const orders = await db.query("SELECT status FROM orders WHERE id = ?", [line.order_id]);
  if (orders[0]?.status === "completed") return res.redirect(`/orders/${line.order_id}`);

  const quantity = parseMoney(req.body.quantity) || 1;
  const unit_price = parseMoney(req.body.unit_price);
  const master_id = req.body.master_id ? Number(req.body.master_id) : null;
  const work_status = String(req.body.work_status ?? line.work_status ?? "pending");
  const labor_minutes = req.body.labor_minutes ? Number(req.body.labor_minutes) : null;
  const cost_price =
    req.body.cost_price != null ? parseMoney(req.body.cost_price) : Number(line.cost_price) || 0;

  await db.query(
    `
    UPDATE order_lines SET
      quantity = ?, unit_price = ?, total = ?,
      master_id = ?, work_status = ?, labor_minutes = ?, cost_price = ?
    WHERE id = ?
  `,
    [quantity, unit_price, parseMoney(quantity * unit_price), master_id, work_status, labor_minutes, cost_price, lineId]
  );

  await recomputeOrderTotals(line.order_id);
  return res.redirect(`/orders/${line.order_id}`);
}

async function removeLine(req, res) {
  const lineId = Number(req.params.lineId);
  const db = await getDB();
  const lines = await db.query("SELECT order_id FROM order_lines WHERE id = ?", [lineId]);
  if (!lines.length) return res.status(404).send("Not found");
  const orderId = lines[0].order_id;
  await db.query("DELETE FROM order_lines WHERE id = ?", [lineId]);
  await recomputeOrderTotals(orderId);
  return res.redirect(`/orders/${orderId}`);
}

async function addPayment(req, res) {
  const orderId = Number(req.params.id);
  const amount = parseMoney(req.body.amount);
  const method = String(req.body.method ?? "other");
  const kind = String(req.body.kind ?? "payment");
  if (amount <= 0) return res.redirect(`/orders/${orderId}`);

  const db = await getDB();
  const orders = await db.query("SELECT total_price FROM orders WHERE id = ?", [orderId]);
  const total = parseMoney(orders[0]?.total_price);
  const paid = await getPaidAmount(db, orderId);
  const delta = kind === "refund" ? -amount : amount;
  if (paid + delta > total + 0.005) {
    return res.redirect(`/orders/${orderId}`);
  }

  await db.query(
    `
    INSERT INTO payments(order_id, amount, method, kind, note, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `,
    [orderId, amount, method, kind, String(req.body.note ?? "").trim() || null, req.session.user?.id || null]
  );
  return res.redirect(`/orders/${orderId}`);
}

async function loadAssigned(db, order) {
  if (!order.assigned_user_id) return null;
  const rows = await db.query("SELECT name FROM users WHERE id = ?", [order.assigned_user_id]);
  return rows[0]?.name || null;
}

function todayStr() {
  return new Date().toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
}

async function printView(req, res) {
  const db = await getDB();
  const ctx = await getOrderContext(db, Number(req.params.id));
  if (!ctx) return res.status(404).send("Not found");
  const assigned_name = await loadAssigned(db, ctx.order);
  res.render("orders/print", { ...ctx, assigned_name, printDate: todayStr(), user: req.session.user });
}

async function actAcceptance(req, res) {
  const db = await getDB();
  const ctx = await getOrderContext(db, Number(req.params.id));
  if (!ctx) return res.status(404).send("Not found");
  const assigned_name = await loadAssigned(db, ctx.order);
  res.render("orders/act-acceptance", { ...ctx, assigned_name, printDate: todayStr(), user: req.session.user });
}

async function actCompletion(req, res) {
  const db = await getDB();
  const ctx = await getOrderContext(db, Number(req.params.id));
  if (!ctx) return res.status(404).send("Not found");
  const assigned_name = await loadAssigned(db, ctx.order);
  res.render("orders/act-completion", { ...ctx, assigned_name, printDate: todayStr(), user: req.session.user });
}

async function uploadPhotos(req, res) {
  const orderId = Number(req.params.id);
  const db = await getDB();
  const files = req.files || [];
  for (const f of files) {
    const rel = relativePathFor(orderId, f.filename);
    await db.query(
      `INSERT INTO order_photos(order_id, file_path, original_name, uploaded_by) VALUES (?, ?, ?, ?)`,
      [orderId, rel, f.originalname || null, req.session.user?.id || null]
    );
  }
  return res.redirect(`/orders/${orderId}`);
}

async function servePhoto(req, res) {
  const orderId = Number(req.params.id);
  const photoId = Number(req.params.photoId);
  const db = await getDB();
  const rows = await db.query("SELECT file_path FROM order_photos WHERE id = ? AND order_id = ?", [
    photoId,
    orderId
  ]);
  if (!rows.length) return res.status(404).send("Not found");
  const abs = absolutePathFor(rows[0].file_path);
  if (!fs.existsSync(abs)) return res.status(404).send("Not found");
  return res.sendFile(abs);
}

async function deletePhoto(req, res) {
  const orderId = Number(req.params.id);
  const photoId = Number(req.params.photoId);
  const db = await getDB();
  const rows = await db.query("SELECT file_path FROM order_photos WHERE id = ? AND order_id = ?", [
    photoId,
    orderId
  ]);
  if (rows.length) {
    const abs = absolutePathFor(rows[0].file_path);
    try {
      fs.unlinkSync(abs);
    } catch {
      // ignore missing file
    }
    await db.query("DELETE FROM order_photos WHERE id = ?", [photoId]);
  }
  return res.redirect(`/orders/${orderId}`);
}

module.exports = {
  list,
  showNew,
  create,
  update,
  changeStatus,
  show,
  addLine,
  updateLine,
  removeLine,
  addPayment,
  printView,
  actAcceptance,
  actCompletion,
  uploadPhotos,
  servePhoto,
  deletePhoto
};
