const { getDB } = require("../config/database");
const { sqlNow } = require("../config/sqlDialect");
const { parseMoney } = require("../lib/money");
const { loadTaxSettings, ensureDefaultSettings } = require("../lib/settings");
const { recomputeOrderTotals, getPaidAmount } = require("../lib/orderTotals");
const {
  onOrderStatusChange,
  freezeOrderEarned,
  computeEarnedForLine,
  resolveCompRule,
  getSharedMaterialsCost,
  allocateMaterialsToLine
} = require("../lib/payroll");
const { loadPayrollSettings } = require("../lib/settings");
const {
  WORK_TYPES,
  parseWorkTypes,
  normalizeWorkTypesFromBody,
  primaryWorkType,
  lineTypeForWorkType
} = require("../lib/workTypes");
const { normalizePlate, normalizePlateStrict, normalizePhone, normalizeVin } = require("../lib/normalize");
const { likePattern, likePatternFolded, lcLike, foldSearchCase } = require("../lib/sqlSearch");
const { relativePathFor, absolutePathFor } = require("../lib/upload");
const { loadOrderEconomics, loadOrderLinkedExpenses } = require("../lib/orderEconomics");
const { priceForVehicleTier, normalizeVehicleTier } = require("../lib/catalogPricing");
const { statusLabel, ORDER_STATUS_LABELS } = require("../lib/orderStatusLabels");
const {
  validateCanAssign,
  loadAbsencesForDate,
  orderOverlapsAbsence
} = require("../lib/staffAbsence");
const fs = require("node:fs");

function normalizeTime(value) {
  const s = String(value ?? "").trim();
  if (/^\d{2}:\d{2}$/.test(s)) return s;
  if (/^\d{1}:\d{2}$/.test(s)) return `0${s}`;
  return null;
}

function parseOptionalId(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function normalizeUserId(value) {
  return parseOptionalId(value);
}

function parseOptionalInt(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function parseMasterIds(body) {
  let raw = body.master_ids;
  if (raw == null) raw = body["master_ids[]"];
  if (raw == null && body.master_id != null && body.master_id !== "") raw = body.master_id;
  if (raw == null) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  const ids = [];
  const seen = new Set();
  for (const v of arr) {
    const id = parseOptionalId(v);
    if (id && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

async function insertOrderLine(db, payload) {
  const params = [
    payload.orderId,
    payload.line_type,
    payload.catalogId,
    payload.name,
    foldSearchCase(payload.name),
    payload.quantity,
    payload.unit_price,
    payload.lineTotal,
    payload.master_id,
    payload.work_status,
    payload.labor_minutes,
    payload.cost_price,
    payload.notes ?? null,
    payload.vehicle_tier ?? null
  ];
  let lineId = null;
  if (typeof db.insertReturning === "function") {
    lineId = await db.insertReturning(
      `
      INSERT INTO order_lines(
        order_id, line_type, catalog_item_id, name, name_lc, quantity, unit_price, total,
        master_id, work_status, labor_minutes, cost_price, notes, vehicle_tier
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      params
    );
  } else {
    await db.query(
      `
      INSERT INTO order_lines(
        order_id, line_type, catalog_item_id, name, name_lc, quantity, unit_price, total,
        master_id, work_status, labor_minutes, cost_price, notes, vehicle_tier
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      params
    );
    const rows = await db.query("SELECT id FROM order_lines WHERE order_id = ? ORDER BY id DESC LIMIT 1", [
      payload.orderId
    ]);
    lineId = rows[0]?.id;
  }
  if (lineId && payload.line_type === "work" && payload.master_id) {
    try {
      await db.query(
        `INSERT INTO order_line_payroll(order_line_id, user_id, share_percent) VALUES (?, ?, 100)`,
        [lineId, payload.master_id]
      );
    } catch {
      // table may not exist before migration
    }
  }
  return lineId;
}

const PAGE_SIZE = 50;
const ORDER_STATUSES = ["scheduled", "in_progress", "ready", "completed", "cancelled"];
const ACTIVE_STATUS_OPTIONS = ["scheduled", "in_progress", "ready", "completed"];

function canManageOrderStatus(role) {
  return role === "owner" || role === "admin" || role === "manager";
}

const STAFF_ROLES_SQL = "('master','manager','admin','owner')";

async function loadMasters(db) {
  return db.query(
    `SELECT id, name, username FROM users WHERE role IN ${STAFF_ROLES_SQL} AND is_active = 1 ORDER BY name`
  );
}

async function loadMastersForSchedule(db, scheduledDate, startTime, endTime, currentUserId = null) {
  const masters = await loadMasters(db);
  if (!scheduledDate) {
    return masters.map((m) => ({ ...m, absent: false }));
  }
  const absences = await loadAbsencesForDate(db, scheduledDate);
  return masters.map((m) => ({
    ...m,
    absent:
      Number(currentUserId) === Number(m.id)
        ? false
        : orderOverlapsAbsence(absences, m.id, startTime, endTime)
  }));
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
  const lines = await db.query(
    `
    SELECT ol.*, u.name AS master_name
    FROM order_lines ol
    LEFT JOIN users u ON u.id = ol.master_id
    WHERE ol.order_id = ?
    ORDER BY ol.id
  `,
    [orderId]
  );
  const works = lines.filter((l) => l.line_type === "work");
  const products = lines.filter((l) => l.line_type === "product");
  const paid_amount = await getPaidAmount(db, orderId);
  const due_amount = Math.max(0, parseMoney(order.total_price) - paid_amount);
  const payments = await db.query("SELECT * FROM payments WHERE order_id = ? ORDER BY paid_at DESC", [orderId]);
  return { order, works, products, paid_amount, due_amount, payments };
}

async function list(req, res) {
  if (req.session.user?.role === "master") {
    return res.redirect("/");
  }
  const db = await getDB();
  const status = String(req.query.status ?? "").trim();
  const search = String(req.query.search ?? "").trim();
  const assigned_user_id = parseOptionalId(req.query.assigned_user_id);
  const due_only = req.query.due_only === "1" || req.query.due_only === "true";
  const page = Math.max(1, Number(req.query.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const where = [];
  const params = [];
  if (status) {
    where.push("o.status = ?");
    params.push(status);
  }
  if (assigned_user_id) {
    where.push("o.assigned_user_id = ?");
    params.push(assigned_user_id);
  }
  if (search) {
    const plateNorm = normalizePlate(search).license_plate_normalized;
    const like = likePattern(search);
    const digits = search.replace(/\D/g, "");
    if (plateNorm) {
      where.push(
        `(c.license_plate_normalized LIKE ? OR ${lcLike("cl.full_name_lc")} OR cl.phone_normalized LIKE ? OR CAST(o.id AS TEXT) LIKE ?)`
      );
      params.push(`%${plateNorm}%`, likePatternFolded(search), `%${digits || search}%`, likePattern(search));
    } else {
      where.push(
        `(${lcLike("cl.full_name_lc")} OR cl.phone_normalized LIKE ? OR c.license_plate_normalized LIKE ? OR CAST(o.id AS TEXT) LIKE ?)`
      );
      params.push(likePatternFolded(search), `%${digits || search}%`, `%${search.toUpperCase().replace(/[\s-]/g, "")}%`, likePattern(search));
    }
  }
  if (due_only) {
    where.push("o.status NOT IN ('cancelled')");
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  let orders = await db.query(
    `
    SELECT o.id, o.opened_at, o.status, o.work_type, o.total_price, o.assigned_user_id,
           au.name AS assigned_user_name,
           c.license_plate_raw, c.make AS car_make, cl.full_name AS client_name, cl.phone_raw AS client_phone
    FROM orders o
    JOIN cars c ON c.id = o.car_id
    JOIN clients cl ON cl.id = c.client_id
    LEFT JOIN users au ON au.id = o.assigned_user_id
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
  if (due_only) {
    orders = orders.filter((o) => o.due_amount > 0);
  }
  const masters = await loadMasters(db);

  res.render("orders/list", {
    orders,
    filters: { status, search, due_only, assigned_user_id: assigned_user_id || "" },
    masters,
    statuses: ORDER_STATUSES,
    statusLabels: ORDER_STATUS_LABELS,
    user: req.session.user,
    category: "orders"
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
  const today = new Date().toISOString().slice(0, 10);
  const masters = await loadMastersForSchedule(
    db,
    req.query.scheduled_date || today,
    req.query.start_time || "",
    req.query.end_time || ""
  );

  const plateQuery = String(req.query.plate ?? "").trim();
  let plateMatches = [];
  let selectedCarId = req.query.car_id ? String(req.query.car_id) : "";
  if (plateQuery) {
    plateMatches = await findCarsByPlate(db, plateQuery);
    if (plateMatches.length === 1 && !req.query.car_id) selectedCarId = String(plateMatches[0].id);
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
      end_time: req.query.end_time || "",
      new_plate: plateQuery || ""
    },
    cars,
    masters,
    plateQuery,
    plateMatches,
    workTypes: WORK_TYPES,
    selectedWorkTypes: ["Электрика"],
    error: null,
    user: req.session.user,
    category: "orders"
  });
}

async function resolveOrCreateCar(db, body) {
  const existingId = Number(body.car_id);
  if (Number.isFinite(existingId) && existingId > 0) return existingId;

  const plate = normalizePlateStrict(body.new_plate);
  if (plate.error) return { error: plate.error };
  const make = String(body.new_make ?? "").trim() || null;
  const model = String(body.new_model ?? "").trim() || null;
  const body_type = String(body.new_body_type ?? "").trim() || null;
  const vehicle_model_id = body.vehicle_model_id ? Number(body.vehicle_model_id) : null;
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
    `INSERT INTO clients(full_name, full_name_lc, phone_raw, phone_normalized) VALUES (?, ?, ?, ?)`,
    [ownerName, foldSearchCase(ownerName), phone_raw, phone_normalized]
  );

  const carId = await db.insertReturning(
    `
    INSERT INTO cars(client_id, make, model, make_lc, model_lc, vin, license_plate_raw, license_plate_normalized, year, body_type, vehicle_model_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    [
      clientId,
      make,
      model,
      make ? foldSearchCase(make) : null,
      model ? foldSearchCase(model) : null,
      vin,
      plate.license_plate_raw,
      plate.license_plate_normalized,
      year,
      body_type,
      Number.isFinite(vehicle_model_id) ? vehicle_model_id : null
    ]
  );
  return carId;
}

async function create(req, res) {
  const work_type = normalizeWorkTypesFromBody(req.body) || "Электрика";
  const notes = String(req.body.notes ?? "").trim() || null;
  const scheduled_date = String(req.body.scheduled_date ?? "").slice(0, 10) || new Date().toISOString().slice(0, 10);
  const assigned_user_id = normalizeUserId(req.body.assigned_user_id);
  const start_time = normalizeTime(req.body.start_time);
  const end_time = normalizeTime(req.body.end_time);

  const db = await getDB();

  async function renderError(error) {
    const cars = await loadCarsForSelect(db);
    const masters = await loadMastersForSchedule(
      db,
      scheduled_date,
      start_time,
      end_time,
      assigned_user_id
    );
    return res.status(400).render("orders/form", {
      order: req.body,
      cars,
      masters,
      plateQuery: "",
      plateMatches: [],
      workTypes: WORK_TYPES,
      selectedWorkTypes: parseWorkTypes(req.body.work_type),
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

  const absenceErr = await validateCanAssign(db, assigned_user_id, scheduled_date, start_time, end_time);
  if (absenceErr) return renderError(absenceErr);

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
  const masters = await loadMastersForSchedule(
    db,
    ctx.order.scheduled_date,
    ctx.order.start_time,
    ctx.order.end_time,
    ctx.order.assigned_user_id
  );

  const photos = await db.query(
    "SELECT id, file_path, original_name FROM order_photos WHERE order_id = ? ORDER BY id DESC",
    [Number(req.params.id)]
  );

  const role = req.session.user?.role;
  const isOwnerView = role === "owner" || role === "admin";
  const isManagerView = role === "manager";
  const isMasterView = role === "master";
  const { roleHasPermission } = require("../config/permissions");
  const canAnnotateOrder =
    role === "owner" || (await roleHasPermission(db, role, "orders:annotate"));
  let works = ctx.works;
  if (isMasterView && req.session.user?.id) {
    works = works.filter((l) => Number(l.master_id) === Number(req.session.user.id));
  }

  let economics = null;
  let orderExpenses = [];
  if (isOwnerView) {
    economics = await loadOrderEconomics(db, Number(req.params.id));
    orderExpenses = await loadOrderLinkedExpenses(db, Number(req.params.id));
  }

  if (isMasterView && req.session.user?.id) {
    const fallback = await loadPayrollSettings(db);
    const sharedMaterials = await getSharedMaterialsCost(db, Number(req.params.id));
    const worksTotal = works.reduce((s, l) => s + (Number(l.total) || 0), 0);
    for (const line of works) {
      const allocatedMaterials = allocateMaterialsToLine(line, sharedMaterials, worksTotal);
      const rule = await resolveCompRule(
        db,
        line.master_id,
        line.catalog_item_id,
        new Date().toISOString().slice(0, 10),
        fallback
      );
      line.payroll_estimate = computeEarnedForLine(line, rule, { allocatedMaterials }).earned;
    }
  }

  res.render("orders/show", {
    ...ctx,
    works,
    catalogWorks,
    catalogProducts,
    masters,
    photos,
    economics,
    orderExpenses,
    isOwnerView,
    isManagerView,
    isMasterView,
    canAnnotateOrder,
    canChangeOrderStatus: canManageOrderStatus(role),
    statusOptions: canManageOrderStatus(role) ? ORDER_STATUSES : ACTIVE_STATUS_OPTIONS,
    statuses: ORDER_STATUSES,
    statusLabels: ORDER_STATUS_LABELS,
    statusLabel,
    user: req.session.user,
    category: "orders",
    scheduleError: req.query.schedule_error === "1" ? "Мастер отсутствует в это время" : null,
    workTypeError: req.query.work_type_error === "1" ? "Выберите хотя бы один тип работ" : null,
    workTypes: WORK_TYPES,
    selectedWorkTypes: parseWorkTypes(ctx.order.work_type),
    catalogWorkCategory:
      parseWorkTypes(ctx.order.work_type).length === 1 ? primaryWorkType(ctx.order.work_type) : ""
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
  const work_type = normalizeWorkTypesFromBody(req.body);
  if (!work_type) {
    return res.redirect(`/orders/${id}?work_type_error=1`);
  }
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

  const absenceErr = await validateCanAssign(db, assigned_user_id, scheduled_date, start_time, end_time);
  if (absenceErr) {
    return res.redirect(`/orders/${id}?schedule_error=1`);
  }

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

async function updateNotes(req, res) {
  const id = Number(req.params.id);
  const db = await getDB();
  const rows = await db.query("SELECT id FROM orders WHERE id = ?", [id]);
  if (!rows.length) return res.status(404).send("Not found");

  const notes = String(req.body.notes ?? "").trim() || null;
  const now = sqlNow(db.dialect);
  await db.query(`UPDATE orders SET notes = ?, updated_at = ${now} WHERE id = ?`, [notes, id]);
  return res.redirect(`/orders/${id}`);
}

async function changeStatus(req, res) {
  const id = Number(req.params.id);
  const status = String(req.body.status ?? "");
  if (!ORDER_STATUSES.includes(status)) {
    return res.redirect(`/orders/${id}`);
  }

  const db = await getDB();
  const rows = await db.query("SELECT status, closed_at FROM orders WHERE id = ?", [id]);
  if (!rows.length) return res.status(404).send("Not found");

  const previousStatus = rows[0].status;
  const manageStatus = canManageOrderStatus(req.session.user?.role);
  if (!manageStatus && (previousStatus === "completed" || previousStatus === "cancelled")) {
    return res.redirect(`/orders/${id}`);
  }

  let closed_at = rows[0].closed_at;
  if (status === "completed") {
    closed_at =
      closed_at || new Date().toISOString().slice(0, 19).replace("T", " ");
  } else if (manageStatus) {
    closed_at = null;
  }

  const now = sqlNow(db.dialect);
  await db.query(
    `UPDATE orders SET status = ?, closed_at = ?, updated_at = ${now} WHERE id = ?`,
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

  const catalogId = parseOptionalId(req.body.catalog_item_id);
  let name = String(req.body.name ?? "").trim();
  let unit_price = parseMoney(req.body.unit_price);
  const quantity = parseMoney(req.body.quantity) || 1;
  let lineNotes = String(req.body.line_notes ?? "").trim() || null;
  let vehicle_tier = parseOptionalInt(req.body.vehicle_tier);

  let catalogMaterialCost = 0;
  if (catalogId) {
    const cat = await db.query(
      `SELECT name, description, default_price, price_tier_2, price_tier_3, type, default_material_cost
       FROM catalog_items WHERE id = ?`,
      [catalogId]
    );
    if (cat[0]) {
      name = cat[0].name;
      catalogMaterialCost = parseMoney(cat[0].default_material_cost);
      if (!lineNotes && cat[0].description) lineNotes = cat[0].description;
      if (!req.body.unit_price) {
        vehicle_tier = normalizeVehicleTier(vehicle_tier);
        unit_price = priceForVehicleTier(cat[0], vehicle_tier);
      }
      if (cat[0].type !== line_type) line_type = cat[0].type;
    }
  }
  if (!name) return res.redirect(`/orders/${orderId}`);
  if (vehicle_tier != null) vehicle_tier = normalizeVehicleTier(vehicle_tier);

  const labor_minutes = parseOptionalInt(req.body.labor_minutes);
  let cost_price = 0;
  if (line_type === "product") {
    cost_price =
      req.body.cost_price != null && req.body.cost_price !== ""
        ? parseMoney(req.body.cost_price)
        : catalogMaterialCost;
  } else if (req.body.material_cost != null && req.body.material_cost !== "") {
    cost_price = parseMoney(req.body.material_cost);
  } else {
    cost_price = catalogMaterialCost;
  }
  const lineTotal = parseMoney(quantity * unit_price);

  if (line_type === "work") {
    const masterIds = parseMasterIds(req.body);
    const n = masterIds.length || 1;
    const splitUnit = parseMoney(unit_price / n);
    const splitTotal = parseMoney(lineTotal / n);
    const splitMaterial = parseMoney(cost_price / n);
    const targets = masterIds.length ? masterIds : [null];
    for (const master_id of targets) {
      await insertOrderLine(db, {
        orderId,
        line_type,
        catalogId,
        name,
        quantity,
        unit_price: splitUnit,
        lineTotal: splitTotal,
        master_id,
        work_status: "pending",
        labor_minutes,
        cost_price: splitMaterial,
        notes: lineNotes,
        vehicle_tier
      });
    }
  } else {
    await insertOrderLine(db, {
      orderId,
      line_type,
      catalogId,
      name,
      quantity,
      unit_price,
      lineTotal,
      master_id: null,
      work_status: null,
      labor_minutes: null,
      cost_price,
      notes: lineNotes,
      vehicle_tier
    });
  }

  await recomputeOrderTotals(orderId);
  const statusRows = await db.query("SELECT status FROM orders WHERE id = ?", [orderId]);
  if (statusRows[0]?.status === "completed") {
    await freezeOrderEarned(orderId);
  }
  return res.redirect(`/orders/${orderId}`);
}

async function syncLinePayrollRow(db, lineId, master_id) {
  try {
    await db.query("DELETE FROM order_line_payroll WHERE order_line_id = ?", [lineId]);
    if (master_id) {
      await db.query(
        `INSERT INTO order_line_payroll(order_line_id, user_id, share_percent) VALUES (?, ?, 100)`,
        [lineId, master_id]
      );
    }
  } catch {
    // table optional before migration
  }
}

async function clearLinePayrollFrozen(db, lineId) {
  await db.query(
    `
    UPDATE order_lines SET
      master_comp_mode = NULL,
      master_comp_value = NULL,
      master_earned_amount = NULL
    WHERE id = ?
  `,
    [lineId]
  );
  try {
    await db.query(
      `UPDATE order_line_payroll SET earned_amount = NULL, master_comp_mode = NULL, master_comp_value = NULL WHERE order_line_id = ?`,
      [lineId]
    );
  } catch {
    // ignore
  }
}

async function updateLine(req, res) {
  const lineId = Number(req.params.lineId);
  const db = await getDB();
  const lines = await db.query("SELECT * FROM order_lines WHERE id = ?", [lineId]);
  const line = lines[0];
  if (!line) return res.status(404).send("Not found");

  const orders = await db.query("SELECT status FROM orders WHERE id = ?", [line.order_id]);
  const orderStatus = orders[0]?.status;
  if (orderStatus === "cancelled") return res.redirect(`/orders/${line.order_id}`);

  const quantity = parseMoney(req.body.quantity) || 1;
  const unit_price = parseMoney(req.body.unit_price);
  const master_id =
    line.line_type === "work" ? parseOptionalId(req.body.master_id) : parseOptionalId(line.master_id);
  const work_status = String(req.body.work_status ?? line.work_status ?? "pending");
  const labor_minutes = parseOptionalInt(req.body.labor_minutes);
  const cost_price =
    req.body.material_cost != null
      ? parseMoney(req.body.material_cost)
      : req.body.cost_price != null
        ? parseMoney(req.body.cost_price)
        : Number(line.cost_price) || 0;

  if (line.line_type === "work") {
    await clearLinePayrollFrozen(db, lineId);
    await syncLinePayrollRow(db, lineId, master_id);
  }

  await db.query(
    `
    UPDATE order_lines SET
      quantity = ?, unit_price = ?, total = ?,
      master_id = ?, work_status = ?, labor_minutes = ?, cost_price = ?
    WHERE id = ?
  `,
    [
      quantity,
      unit_price,
      parseMoney(quantity * unit_price),
      line.line_type === "work" ? master_id : line.master_id,
      work_status,
      labor_minutes,
      cost_price,
      lineId
    ]
  );

  await recomputeOrderTotals(line.order_id);
  if (orderStatus === "completed") {
    await freezeOrderEarned(line.order_id);
    try {
      const { logActivity } = require("../lib/activityLog");
      await logActivity(db, {
        user_id: req.session.user?.id,
        action: "update",
        entity_type: "order_line",
        entity_id: lineId,
        details: {
          order_id: line.order_id,
          order_status: orderStatus,
          quantity,
          unit_price,
          master_id: line.line_type === "work" ? master_id : line.master_id,
          line_type: line.line_type
        }
      });
    } catch {
      // activity_logs table may be missing before migration 009
    }
  }
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
  updateNotes,
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
