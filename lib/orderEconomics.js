const { round2, parseMoney } = require("./money");
const { getOrderMaterialsCost } = require("./payroll");

async function sumOrderPayroll(db, orderId) {
  const lines = await db.query(
    "SELECT id, master_earned_amount FROM order_lines WHERE order_id = ? AND line_type = 'work'",
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
        total += Number(pr.earned_amount) || 0;
      }
    } else {
      total += Number(line.master_earned_amount) || 0;
    }
  }
  return round2(total);
}

async function loadOrderEconomics(db, orderId) {
  const orders = await db.query(
    "SELECT total_price, tax_amount, status FROM orders WHERE id = ?",
    [orderId]
  );
  const order = orders[0];
  if (!order) return null;

  const revenue = parseMoney(order.total_price);
  const materials = await getOrderMaterialsCost(db, orderId);
  const payroll = await sumOrderPayroll(db, orderId);
  const tax = parseMoney(order.tax_amount);
  const profit = round2(revenue - materials - payroll);

  return {
    revenue,
    materials,
    payroll,
    tax,
    profit,
    is_completed: order.status === "completed"
  };
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
  sumOrderPayroll
};
