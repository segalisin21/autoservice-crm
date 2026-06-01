const { getDB } = require("../config/database");
const { parseMoney } = require("../lib/money");
const { parseDateRange } = require("../lib/finance");
const { loadPayrollSettings, ensureDefaultSettings } = require("../lib/settings");
const {
  loadMasterPayrollBalances,
  loadMasterEarnedLines,
  loadMasterPayoutsForUser,
  loadRecentPayouts
} = require("../lib/payrollBalance");

const COMP_MODES = ["net_percent", "percent", "fixed", "hourly"];

async function loadMasters(db) {
  return db.query(
    "SELECT id, name, username, role FROM users WHERE role IN ('master','admin','owner') AND is_active = 1 ORDER BY name"
  );
}

async function canMutatePayroll(req) {
  if (req.session.user.role === "owner") return true;
  const db = await getDB();
  const { roleHasPermission } = require("../config/permissions");
  return roleHasPermission(db, req.session.user.role, "payroll:mutate");
}

async function index(req, res) {
  const db = await getDB();
  const range = parseDateRange(req.query);
  const filterUserId = req.query.user_id ? Number(req.query.user_id) : null;

  let masters = await loadMasters(db);
  if (req.session.user.role === "master") {
    masters = masters.filter((m) => m.id === req.session.user.id);
  }

  const summaryUserIds = filterUserId ? [filterUserId] : masters.map((m) => m.id);
  const summary = await loadMasterPayrollBalances(db, {
    start_date: range.start_date,
    end_date: range.end_date,
    userIds: summaryUserIds
  });

  const payrollDetails = {};
  for (const s of summary) {
    payrollDetails[s.id] = {
      earnedLines: await loadMasterEarnedLines(db, s.id, {
        start_date: range.start_date,
        end_date: range.end_date
      }),
      payouts: await loadMasterPayoutsForUser(db, s.id, {
        start_date: range.start_date,
        end_date: range.end_date,
        limit: 20
      })
    };
  }

  const rules = await db.query(
    `
    SELECT r.*, u.name AS user_name
    FROM master_comp_rules r
    JOIN users u ON u.id = r.user_id
    WHERE r.is_active = 1
    ORDER BY r.id DESC
    LIMIT 50
  `
  );

  const overrides = await db.query(
    `
    SELECT o.*, u.name AS user_name, ci.name AS item_name
    FROM master_comp_overrides o
    JOIN users u ON u.id = o.user_id
    JOIN catalog_items ci ON ci.id = o.catalog_item_id
    ORDER BY o.id DESC
    LIMIT 100
  `
  );

  const works = await db.query(
    "SELECT id, name FROM catalog_items WHERE type = 'work' AND is_active = 1 ORDER BY category, name LIMIT 300"
  );

  const allMasters = await loadMasters(db);
  await ensureDefaultSettings(db);
  const payrollDefault = await loadPayrollSettings(db);
  const recentPayouts = await loadRecentPayouts(db, 25);
  const mutate = await canMutatePayroll(req);

  res.render("admin/payroll", {
    summary,
    payrollDetails,
    rules,
    overrides,
    works,
    payrollDefault,
    recentPayouts,
    modes: COMP_MODES,
    masters: allMasters,
    range,
    filterUserId,
    user: req.session.user,
    category: "payroll",
    adminSection: "payroll",
    canMutate: mutate
  });
}

async function saveRule(req, res) {
  if (!(await canMutatePayroll(req))) {
    return res.status(403).send("Forbidden");
  }
  const user_id = Number(req.body.user_id);
  const mode = String(req.body.mode ?? "net_percent");
  const value = parseMoney(req.body.value);
  const effective_from = String(req.body.effective_from ?? new Date().toISOString().slice(0, 10));

  if (!user_id || !COMP_MODES.includes(mode)) {
    return res.redirect("/admin/payroll");
  }

  const db = await getDB();
  await db.query(
    "UPDATE master_comp_rules SET is_active = 0 WHERE user_id = ? AND is_active = 1",
    [user_id]
  );
  await db.query(
    `INSERT INTO master_comp_rules(user_id, mode, value, effective_from, is_active) VALUES (?, ?, ?, ?, 1)`,
    [user_id, mode, value, effective_from]
  );
  return res.redirect("/admin/payroll");
}

async function savePayout(req, res) {
  if (!(await canMutatePayroll(req))) {
    return res.status(403).send("Forbidden");
  }
  const user_id = Number(req.body.user_id);
  const amount = parseMoney(req.body.amount);
  const method = String(req.body.method ?? "other");
  const note = String(req.body.note ?? "").trim() || null;
  const period_start = String(req.body.period_start ?? "").slice(0, 10) || null;
  const period_end = String(req.body.period_end ?? "").slice(0, 10) || null;

  if (!user_id || amount <= 0) {
    return res.redirect("/admin/payroll");
  }

  const db = await getDB();
  try {
    await db.query(
      `INSERT INTO payouts(user_id, amount, method, note, period_start, period_end, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user_id, amount, method, note, period_start, period_end, req.session.user.id]
    );
  } catch {
    await db.query(
      `INSERT INTO payouts(user_id, amount, method, note, created_by) VALUES (?, ?, ?, ?, ?)`,
      [user_id, amount, method, note, req.session.user.id]
    );
  }
  return res.redirect("/admin/payroll");
}

async function saveOverride(req, res) {
  if (!(await canMutatePayroll(req))) {
    return res.status(403).send("Forbidden");
  }
  const user_id = Number(req.body.user_id);
  const catalog_item_id = Number(req.body.catalog_item_id);
  const mode = String(req.body.mode ?? "percent");
  const value = parseMoney(req.body.value);

  if (!user_id || !catalog_item_id || !COMP_MODES.includes(mode)) {
    return res.redirect("/admin/payroll");
  }

  const db = await getDB();
  await db.query(
    `
    INSERT INTO master_comp_overrides(user_id, catalog_item_id, mode, value)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, catalog_item_id) DO UPDATE SET mode = excluded.mode, value = excluded.value
  `,
    [user_id, catalog_item_id, mode, value]
  );
  return res.redirect("/admin/payroll");
}

async function deleteOverride(req, res) {
  if (!(await canMutatePayroll(req))) {
    return res.status(403).send("Forbidden");
  }
  const db = await getDB();
  await db.query("DELETE FROM master_comp_overrides WHERE id = ?", [Number(req.params.id)]);
  return res.redirect("/admin/payroll");
}

async function saveDefault(req, res) {
  if (!(await canMutatePayroll(req))) {
    return res.status(403).send("Forbidden");
  }
  const mode = String(req.body.mode ?? "net_percent");
  const value = parseMoney(req.body.value);
  if (!COMP_MODES.includes(mode)) {
    return res.redirect("/admin/payroll");
  }
  const db = await getDB();
  await db.query(
    `INSERT INTO settings(key, value) VALUES ('payroll_default_mode', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [mode]
  );
  await db.query(
    `INSERT INTO settings(key, value) VALUES ('payroll_default_value', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [String(value)]
  );
  return res.redirect("/admin/payroll");
}

module.exports = { index, saveRule, savePayout, saveOverride, deleteOverride, saveDefault };
