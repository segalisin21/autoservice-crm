const { round2 } = require("./money");
const { expensesTotalInPeriod } = require("./expenses");

function defaultDateRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start_date: start.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10)
  };
}

function parseDateRange(query) {
  const defaults = defaultDateRange();
  const start_date = String(query.start_date ?? defaults.start_date).slice(0, 10);
  const end_date = String(query.end_date ?? defaults.end_date).slice(0, 10);
  return { start_date, end_date };
}

async function loadFinanceMetrics(db, start_date, end_date) {
  const endExclusive = `${end_date}T23:59:59`;

  const cashRows = await db.query(
    `
    SELECT
      COALESCE(SUM(CASE WHEN kind = 'payment' THEN amount ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN kind = 'refund' THEN amount ELSE 0 END), 0) AS cash_in
    FROM payments
    WHERE paid_at >= ? AND paid_at <= ?
  `,
    [`${start_date} 00:00:00`, endExclusive]
  );

  const revenueRows = await db.query(
    `
    SELECT COALESCE(SUM(total_price), 0) AS orders_net_by_closed_at
    FROM orders
    WHERE status = 'completed' AND closed_at >= ? AND closed_at <= ?
  `,
    [`${start_date} 00:00:00`, endExclusive]
  );

  const grossRows = await db.query(
    `
    SELECT
      COALESCE(SUM(subtotal_works + subtotal_products), 0) AS gross_revenue,
      COALESCE(SUM(discount_amount), 0) AS discounts_total,
      COALESCE(SUM(tax_amount), 0) AS taxes_total
    FROM orders
    WHERE status = 'completed' AND closed_at >= ? AND closed_at <= ?
  `,
    [`${start_date} 00:00:00`, endExclusive]
  );

  const receivableRows = await db.query(
    `
    SELECT o.id, o.total_price
    FROM orders o
    WHERE o.status NOT IN ('completed', 'cancelled')
  `
  );

  let receivables = 0;
  for (const o of receivableRows) {
    const paidRows = await db.query(
      `
      SELECT
        COALESCE(SUM(CASE WHEN kind = 'payment' THEN amount ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN kind = 'refund' THEN amount ELSE 0 END), 0) AS paid
      FROM payments WHERE order_id = ?
    `,
      [o.id]
    );
    const paid = Number(paidRows[0]?.paid) || 0;
    const due = Math.max(0, Number(o.total_price) - paid);
    receivables += due;
  }

  const gross = grossRows[0] || {};
  const discounts = Number(gross.discounts_total) || 0;
  const grossRevenue = Number(gross.gross_revenue) || 0;
  const netRevenue = round2(grossRevenue - discounts);

  const expensesTotal = await expensesTotalInPeriod(db, start_date, end_date);

  return {
    start_date,
    end_date,
    cash_in: round2(cashRows[0]?.cash_in),
    orders_net_by_closed_at: round2(revenueRows[0]?.orders_net_by_closed_at),
    gross_revenue: round2(grossRevenue),
    discounts_total: round2(discounts),
    net_revenue: netRevenue,
    taxes_total: round2(gross.taxes_total),
    receivables: round2(receivables),
    expenses_total: expensesTotal,
    net_profit: round2(netRevenue - expensesTotal)
  };
}

async function loadTopServices(db, start_date, end_date, limit = 10) {
  const endExclusive = `${end_date}T23:59:59`;
  return db.query(
    `
    SELECT ol.name, COUNT(*) AS cnt, SUM(ol.total) AS revenue
    FROM order_lines ol
    JOIN orders o ON o.id = ol.order_id
    WHERE ol.line_type = 'work' AND o.status = 'completed'
      AND o.closed_at >= ? AND o.closed_at <= ?
    GROUP BY ol.name
    ORDER BY revenue DESC
    LIMIT ?
  `,
    [`${start_date} 00:00:00`, endExclusive, limit]
  );
}

module.exports = { parseDateRange, loadFinanceMetrics, loadTopServices, defaultDateRange };
