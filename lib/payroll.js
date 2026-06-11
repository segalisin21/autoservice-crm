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

function lineConsumableCost(line) {
  return round2((Number(line.cost_price) || 0) * (Number(line.quantity) || 1));
}

async function getSharedMaterialsCost(db, orderId) {
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

async function getOrderMaterialsCost(db, orderId) {
  const shared = await getSharedMaterialsCost(db, orderId);
  const workRows = await db.query(
    `SELECT COALESCE(SUM(cost_price * quantity), 0) AS cost
     FROM order_lines WHERE order_id = ? AND line_type = 'work'`,
    [orderId]
  );
  return round2(shared + (Number(workRows[0]?.cost) || 0));
}

function allocateMaterialsToLine(line, sharedMaterialsCost, worksTotal) {
  const lineTotal = Number(line.total) || 0;
  const proportional =
    worksTotal > 0 ? round2(sharedMaterialsCost * (lineTotal / worksTotal)) : 0;
  return round2(proportional + lineConsumableCost(line));
}

async function computeOrderPayrollAmount(db, orderId, opts = {}) {
  const orders = await db.query("SELECT status, closed_at FROM orders WHERE id = ?", [orderId]);
  const order = orders[0];
  if (!order) return 0;

  const effectiveDate =
    opts.effectiveDate ||
    (order.closed_at ? String(order.closed_at).slice(0, 10) : new Date().toISOString().slice(0, 10));
  const fallback = await loadPayrollSettings(db);
  const lines = await db.query(
    "SELECT * FROM order_lines WHERE order_id = ? AND line_type = 'work'",
    [orderId]
  );

  const sharedMaterials = await getSharedMaterialsCost(db, orderId);
  const worksTotal = round2(lines.reduce((sum, l) => sum + (Number(l.total) || 0), 0));
  let total = 0;

  for (const line of lines) {
    let payrollRows = [];
    try {
      payrollRows = await db.query(
        "SELECT * FROM order_line_payroll WHERE order_line_id = ?",
        [line.id]
      );
    } catch {
      payrollRows = [];
    }

    const lineTotal = Number(line.total) || 0;
    const allocatedMaterials = allocateMaterialsToLine(line, sharedMaterials, worksTotal);

    if (payrollRows.length) {
      for (const pr of payrollRows) {
        if (pr.earned_amount != null && order.status === "completed") {
          total += Number(pr.earned_amount) || 0;
          continue;
        }
        const share = (Number(pr.share_percent) || 0) / 100;
        const virtualLine = {
          ...line,
          total: round2(lineTotal * share),
          master_id: pr.user_id,
          labor_minutes: line.labor_minutes
        };
        const rule = await resolveCompRule(db, pr.user_id, line.catalog_item_id, effectiveDate, fallback);
        const matShare = round2(allocatedMaterials * share);
        const { earned } = computeEarnedForLine(virtualLine, rule, { allocatedMaterials: matShare });
        total += earned;
      }
      continue;
    }

    if (!line.master_id) continue;
    const rule = await resolveCompRule(db, line.master_id, line.catalog_item_id, effectiveDate, fallback);
    const { earned } = computeEarnedForLine(line, rule, { allocatedMaterials });
    total += earned;
  }

  return round2(total);
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

  const sharedMaterials = await getSharedMaterialsCost(db, orderId);
  const worksTotal = round2(lines.reduce((sum, l) => sum + (Number(l.total) || 0), 0));

  for (const line of lines) {
    let payrollRows = [];
    try {
      payrollRows = await db.query(
        "SELECT * FROM order_line_payroll WHERE order_line_id = ?",
        [line.id]
      );
    } catch {
      payrollRows = [];
    }

    const lineTotal = Number(line.total) || 0;
    const allocatedMaterials = allocateMaterialsToLine(line, sharedMaterials, worksTotal);

    if (payrollRows.length) {
      let sumEarned = 0;
      for (const pr of payrollRows) {
        if (pr.earned_amount != null) {
          sumEarned += Number(pr.earned_amount) || 0;
          continue;
        }
        const share = (Number(pr.share_percent) || 0) / 100;
        const virtualLine = {
          ...line,
          total: round2(lineTotal * share),
          master_id: pr.user_id,
          labor_minutes: line.labor_minutes
        };
        const rule = await resolveCompRule(db, pr.user_id, line.catalog_item_id, effectiveDate, fallback);
        const matShare = round2(allocatedMaterials * share);
        const { mode, value, earned } = computeEarnedForLine(virtualLine, rule, {
          allocatedMaterials: matShare
        });
        await db.query(
          `
          UPDATE order_line_payroll SET
            earned_amount = ?,
            master_comp_mode = ?,
            master_comp_value = ?
          WHERE id = ?
        `,
          [earned, mode, value, pr.id]
        );
        sumEarned += earned;
      }
      if (line.master_comp_mode == null) {
        await db.query(
          `
          UPDATE order_lines SET
            master_comp_mode = ?,
            master_comp_value = ?,
            master_earned_amount = ?
          WHERE id = ?
        `,
          ["split", null, round2(sumEarned), line.id]
        );
      }
      continue;
    }

    if (line.master_comp_mode != null) {
      continue;
    }
    const rule = await resolveCompRule(db, line.master_id, line.catalog_item_id, effectiveDate, fallback);
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
  lineConsumableCost,
  getSharedMaterialsCost,
  getOrderMaterialsCost,
  allocateMaterialsToLine,
  computeOrderPayrollAmount,
  freezeOrderEarned,
  onOrderStatusChange
};
