const { getDB } = require("../config/database");
const { round2 } = require("./money");
const { loadPayrollSettings } = require("./settings");

async function resolveCompRule(db, masterId, catalogItemId, effectiveDate, fallback = null) {
  if (!masterId) return fallback;

  if (catalogItemId) {
    const overrides = await db.query(
      `
      SELECT mode, value FROM master_comp_overrides
      WHERE user_id = ? AND catalog_item_id = ?
      LIMIT 1
    `,
      [masterId, catalogItemId]
    );
    if (overrides[0]) return overrides[0];
  }

  const date = effectiveDate || new Date().toISOString().slice(0, 10);
  const rules = await db.query(
    `
    SELECT mode, value FROM master_comp_rules
    WHERE user_id = ? AND is_active = 1 AND effective_from <= ?
    ORDER BY effective_from DESC
    LIMIT 1
  `,
    [masterId, date]
  );
  return rules[0] || fallback;
}

/**
 * Computes the master's earned amount for a single work line.
 * For mode "net_percent" the materials cost allocated to the line is subtracted
 * from the line total before applying the percentage (50% of (works - расходники)).
 */
function computeEarnedForLine(line, rule, opts = {}) {
  if (!rule) return { mode: null, value: null, earned: 0 };
  const mode = rule.mode;
  const value = Number(rule.value) || 0;
  const lineTotal = Number(line.total) || 0;
  const allocatedMaterials = Number(opts.allocatedMaterials) || 0;

  if (mode === "percent") {
    return { mode, value, earned: round2(lineTotal * (value / 100)) };
  }
  if (mode === "net_percent") {
    const base = Math.max(0, lineTotal - allocatedMaterials);
    return { mode, value, earned: round2(base * (value / 100)) };
  }
  if (mode === "fixed") {
    return { mode, value, earned: round2(value) };
  }
  if (mode === "hourly") {
    const minutes = Number(line.labor_minutes);
    if (!minutes || minutes <= 0) {
      return { mode, value, earned: 0 };
    }
    return { mode, value, earned: round2((minutes / 60) * value) };
  }
  return { mode, value, earned: 0 };
}

async function getOrderMaterialsCost(db, orderId) {
  const lineRows = await db.query(
    `SELECT COALESCE(SUM(cost_price * quantity), 0) AS cost
     FROM order_lines WHERE order_id = ? AND line_type = 'product'`,
    [orderId]
  );
  const expenseRows = await db.query(
    `SELECT COALESCE(SUM(amount), 0) AS cost
     FROM expenses WHERE order_id = ? AND category = 'materials'`,
    [orderId]
  );
  return round2((Number(lineRows[0]?.cost) || 0) + (Number(expenseRows[0]?.cost) || 0));
}

async function freezeOrderEarned(orderId) {
  const db = await getDB();
  const orders = await db.query("SELECT status, closed_at FROM orders WHERE id = ?", [orderId]);
  const order = orders[0];
  if (!order || order.status !== "completed") return;

  const effectiveDate = order.closed_at ? String(order.closed_at).slice(0, 10) : new Date().toISOString().slice(0, 10);
  const fallback = await loadPayrollSettings(db);
  const lines = await db.query(
    "SELECT * FROM order_lines WHERE order_id = ? AND line_type = 'work'",
    [orderId]
  );

  const materialsCost = await getOrderMaterialsCost(db, orderId);
  const worksTotal = round2(lines.reduce((sum, l) => sum + (Number(l.total) || 0), 0));

  for (const line of lines) {
    if (line.master_comp_mode != null) {
      continue;
    }
    const rule = await resolveCompRule(db, line.master_id, line.catalog_item_id, effectiveDate, fallback);
    const lineTotal = Number(line.total) || 0;
    const allocatedMaterials = worksTotal > 0 ? round2(materialsCost * (lineTotal / worksTotal)) : 0;
    const { mode, value, earned } = computeEarnedForLine(line, rule, { allocatedMaterials });
    await db.query(
      `
      UPDATE order_lines SET
        master_comp_mode = ?,
        master_comp_value = ?,
        master_earned_amount = ?
      WHERE id = ?
    `,
      [mode, value, earned, line.id]
    );
  }
}

async function onOrderStatusChange(orderId, previousStatus, newStatus) {
  if (newStatus !== "completed" || previousStatus === "completed") return;
  await freezeOrderEarned(orderId);
}

module.exports = {
  resolveCompRule,
  computeEarnedForLine,
  getOrderMaterialsCost,
  freezeOrderEarned,
  onOrderStatusChange
};
