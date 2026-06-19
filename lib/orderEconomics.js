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

async function loadOrdersEconomicsInPeriod(db, start_date, end_date, status = "completed") {
  const endExclusive = `${end_date}T23:59:59`;
  let whereSql;
  let params;

  if (status === "completed") {
    whereSql = `o.status = 'completed' AND o.closed_at >= ? AND o.closed_at <= ?`;
    params = [`${start_date} 00:00:00`, endExclusive];
  } else if (status === "all") {
    whereSql = `(o.status = 'completed' AND o.closed_at >= ? AND o.closed_at <= ?)
      OR (o.status NOT IN ('cancelled') AND o.scheduled_date >= ? AND o.scheduled_date <= ?)`;
    params = [`${start_date} 00:00:00`, endExclusive, start_date, end_date];
  } else {
    whereSql = `o.status = ? AND o.scheduled_date >= ? AND o.scheduled_date <= ?`;
    params = [status, start_date, end_date];
  }

  const orderRows = await db.query(
    `
    SELECT o.id, o.status, o.closed_at, o.scheduled_date,
           cl.full_name AS client_name, c.make, c.model, c.license_plate_raw
    FROM orders o
    JOIN cars c ON c.id = o.car_id
    JOIN clients cl ON cl.id = c.client_id
    WHERE ${whereSql}
    ORDER BY COALESCE(o.closed_at, o.scheduled_date) DESC, o.id DESC
    LIMIT 200
  `,
    params
  );

  const rows = [];
  for (const o of orderRows) {
    const economics = await loadOrderEconomics(db, o.id);
    if (!economics) continue;
    rows.push({
      order_id: o.id,
      status: o.status,
      closed_at: o.closed_at || o.scheduled_date,
      client_name: o.client_name,
      car_label: [o.make, o.model, o.license_plate_raw].filter(Boolean).join(" "),
      ...economics
    });
  }
  return rows;
}

async function payrollTotalInPeriod(db, start_date, end_date) {
  const endExclusive = `${end_date}T23:59:59`;
  const dates = [`${start_date} 00:00:00`, endExclusive];

  let splitTotal = 0;
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
      dates
    );
    splitTotal = Number(pr[0]?.total) || 0;
  } catch {
    splitTotal = 0;
  }

  const soloRows = await db.query(
    `
    SELECT COALESCE(SUM(ol.master_earned_amount), 0) AS total
    FROM order_lines ol
    JOIN orders o ON o.id = ol.order_id
    WHERE ol.line_type = 'work' AND o.status = 'completed'
      AND o.closed_at >= ? AND o.closed_at <= ?
      AND ol.master_earned_amount IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM order_line_payroll olp WHERE olp.order_line_id = ol.id)
  `,
    dates
  );
  const soloTotal = Number(soloRows[0]?.total) || 0;
  return round2(splitTotal + soloTotal);
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
  const workRows = await db.query(
    `
    SELECT COALESCE(SUM(ol.cost_price * ol.quantity), 0) AS total
    FROM order_lines ol
    JOIN orders o ON o.id = ol.order_id
    WHERE ol.line_type = 'work' AND o.status = 'completed'
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
  return round2(
    (Number(productRows[0]?.total) || 0) +
      (Number(workRows[0]?.total) || 0) +
      (Number(matExpRows[0]?.total) || 0)
  );
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
