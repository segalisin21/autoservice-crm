const { round2, parseMoney } = require("./money");
const {
  getOrderMaterialsCost,
  freezeOrderEarned,
  computeOrderPayrollAmount
} = require("./payroll");

async function sumOrderPayrollFrozen(db, orderId) {
  const lines = await db.query(
    "SELECT id, master_earned_amount, master_comp_mode FROM order_lines WHERE order_id = ? AND line_type = 'work'",
    [orderId]
  );
  let total = 0;
  for (const line of lines) {
    let payrollRows = [];
    try {
      payrollRows = await db.query(
        "SELECT earned_amount FROM order_line_payroll WHERE order_line_id = ?",
        [line.id]
      );
    } catch {
      payrollRows = [];
    }
    if (payrollRows.length) {
      for (const pr of payrollRows) {
        if (pr.earned_amount != null) total += Number(pr.earned_amount) || 0;
      }
    } else if (line.master_comp_mode != null || line.master_earned_amount != null) {
      total += Number(line.master_earned_amount) || 0;
    }
  }
  return round2(total);
}

async function orderHasWorkWithMaster(db, orderId) {
  const rows = await db.query(
    `SELECT 1 FROM order_lines WHERE order_id = ? AND line_type = 'work' AND master_id IS NOT NULL LIMIT 1`,
    [orderId]
  );
  return rows.length > 0;
}

async function loadOrderLinkedExpenses(db, orderId, limit = 5) {
  try {
    return await db.query(
      `SELECT id, expense_date, amount, category, note
       FROM expenses WHERE order_id = ?
       ORDER BY expense_date DESC, id DESC
       LIMIT ?`,
      [orderId, limit]
    );
  } catch {
    return [];
  }
}

async function sumOrderLinkedExpenses(db, orderId) {
  const rows = await db.query(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE order_id = ?`,
    [orderId]
  );
  return round2(Number(rows[0]?.total) || 0);
}

function buildPayrollHints(order, payroll, hasMaster) {
  const hints = [];
  if (payroll > 0) return hints;
  if (!hasMaster) hints.push("Назначьте мастера на работу — иначе ЗП не начисляется.");
  if (order.status !== "completed") hints.push("Переведите заказ в статус «Завершён», чтобы зафиксировать ЗП.");
  return hints;
}

async function loadOrderEconomics(db, orderId) {
  const orders = await db.query(
    "SELECT total_price, tax_amount, status, closed_at FROM orders WHERE id = ?",
    [orderId]
  );
  const order = orders[0];
  if (!order) return null;

  const revenue = parseMoney(order.total_price);
  const materials = await getOrderMaterialsCost(db, orderId);
  const orderExpensesTotal = await sumOrderLinkedExpenses(db, orderId);
  const hasMaster = await orderHasWorkWithMaster(db, orderId);
  const is_completed = order.status === "completed";

  let payroll = 0;
  let is_estimate = false;

  if (is_completed) {
    payroll = await sumOrderPayrollFrozen(db, orderId);
    if (payroll === 0 && hasMaster) {
      await freezeOrderEarned(orderId);
      payroll = await sumOrderPayrollFrozen(db, orderId);
    }
  } else {
    payroll = await computeOrderPayrollAmount(db, orderId, {
      effectiveDate: new Date().toISOString().slice(0, 10)
    });
    is_estimate = true;
  }

  const tax = parseMoney(order.tax_amount);
  const profit = round2(revenue - materials - payroll);
  const hints = buildPayrollHints(order, payroll, hasMaster);

  return {
    revenue,
    materials,
    payroll,
    tax,
    profit,
    order_expenses_total: orderExpensesTotal,
    is_completed,
    is_estimate,
    hints
  };
}

async function estimateOrderPayroll(db, orderId) {
  return computeOrderPayrollAmount(db, orderId, {
    effectiveDate: new Date().toISOString().slice(0, 10)
  });
}

async function payrollTotalInPeriod(db, start_date, end_date) {
  const endExclusive = `${end_date}T23:59:59`;
  const lineRows = await db.query(
    `
    SELECT COALESCE(SUM(ol.master_earned_amount), 0) AS total
    FROM order_lines ol
    JOIN orders o ON o.id = ol.order_id
    WHERE ol.line_type = 'work' AND o.status = 'completed'
      AND o.closed_at >= ? AND o.closed_at <= ?
      AND ol.master_earned_amount IS NOT NULL
  `,
    [`${start_date} 00:00:00`, endExclusive]
  );
  let payrollRows = 0;
  try {
    const pr = await db.query(
      `
      SELECT COALESCE(SUM(olp.earned_amount), 0) AS total
      FROM order_line_payroll olp
      JOIN order_lines ol ON ol.id = olp.order_line_id
      JOIN orders o ON o.id = ol.order_id
      WHERE o.status = 'completed' AND o.closed_at >= ? AND o.closed_at <= ?
        AND olp.earned_amount IS NOT NULL
    `,
      [`${start_date} 00:00:00`, endExclusive]
    );
    payrollRows = Number(pr[0]?.total) || 0;
  } catch {
    payrollRows = 0;
  }
  const lineTotal = Number(lineRows[0]?.total) || 0;
  return round2(Math.max(lineTotal, payrollRows));
}

async function materialsTotalInPeriod(db, start_date, end_date) {
  const endExclusive = `${end_date}T23:59:59`;
  const productRows = await db.query(
    `
    SELECT COALESCE(SUM(ol.cost_price * ol.quantity), 0) AS total
    FROM order_lines ol
    JOIN orders o ON o.id = ol.order_id
    WHERE ol.line_type = 'product' AND o.status = 'completed'
      AND o.closed_at >= ? AND o.closed_at <= ?
  `,
    [`${start_date} 00:00:00`, endExclusive]
  );
  const matExpRows = await db.query(
    `
    SELECT COALESCE(SUM(e.amount), 0) AS total
    FROM expenses e
    JOIN orders o ON o.id = e.order_id
    WHERE e.category = 'materials' AND o.status = 'completed'
      AND o.closed_at >= ? AND o.closed_at <= ?
  `,
    [`${start_date} 00:00:00`, endExclusive]
  );
  return round2((Number(productRows[0]?.total) || 0) + (Number(matExpRows[0]?.total) || 0));
}

async function generalExpensesInPeriod(db, start_date, end_date) {
  const rows = await db.query(
    `
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM expenses
    WHERE expense_date >= ? AND expense_date <= ?
      AND NOT (category = 'materials' AND order_id IS NOT NULL)
  `,
    [start_date, end_date]
  );
  return round2(Number(rows[0]?.total) || 0);
}

async function loadOrdersEconomicsInPeriod(db, start_date, end_date) {
  const endExclusive = `${end_date}T23:59:59`;
  const orders = await db.query(
    `
    SELECT id, closed_at, status
    FROM orders
    WHERE status = 'completed' AND closed_at >= ? AND closed_at <= ?
    ORDER BY closed_at DESC, id DESC
    LIMIT 200
  `,
    [`${start_date} 00:00:00`, endExclusive]
  );

  const rows = [];
  for (const o of orders) {
    const economics = await loadOrderEconomics(db, o.id);
    if (!economics) continue;
    rows.push({
      order_id: o.id,
      closed_at: o.closed_at,
      ...economics
    });
  }
  return rows;
}

module.exports = {
  loadOrderEconomics,
  loadOrdersEconomicsInPeriod,
  estimateOrderPayroll,
  payrollTotalInPeriod,
  materialsTotalInPeriod,
  generalExpensesInPeriod,
  loadOrderLinkedExpenses,
  sumOrderLinkedExpenses
};
