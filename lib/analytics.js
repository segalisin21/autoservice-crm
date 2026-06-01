const { round2 } = require("./money");
const { sqlDateOf, orderDateSql } = require("../config/sqlDialect");
const { statusLabel } = require("./orderStatusLabels");

const isIsoDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

function todayLocalYmd() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function addCalendarDaysLocal(ymd, delta) {
  const [y, mo, day] = ymd.split("-").map(Number);
  const dt = new Date(y, mo - 1, day);
  dt.setDate(dt.getDate() + delta);
  return dt.toISOString().slice(0, 10);
}

function resolveReportRange(query) {
  const startQ = query.start_date;
  const endQ = query.end_date;
  const periodRaw = query.period != null ? String(query.period) : "30";

  if (periodRaw !== "custom") {
    const n = parseInt(periodRaw, 10);
    if (Number.isFinite(n) && n >= 1) {
      const days = Math.min(366, n);
      const endDate = todayLocalYmd();
      const startDate = addCalendarDaysLocal(endDate, -(days - 1));
      return { startDate, endDate, period: String(days) };
    }
  }

  if (isIsoDate(startQ) && isIsoDate(endQ)) {
    let a = startQ;
    let b = endQ;
    if (a > b) [a, b] = [b, a];
    return { startDate: a, endDate: b, period: "custom" };
  }

  const endDate = todayLocalYmd();
  const startDate = addCalendarDaysLocal(endDate, -29);
  return { startDate, endDate, period: "30" };
}

async function execScalar(db, sql, params = []) {
  const rows = await db.query(sql, params);
  if (!rows.length) return 0;
  const v = Object.values(rows[0])[0];
  return Number(v) || 0;
}

async function getOverview(db, startDate, endDate) {
  const endExclusive = `${endDate}T23:59:59`;
  const closedFrom = `${startDate} 00:00:00`;
  const orderDate = orderDateSql(db.dialect);

  const totalOrders = await execScalar(
    db,
    `
    SELECT COUNT(*) AS c FROM orders o
    WHERE o.status != 'cancelled'
      AND ${orderDate} >= ? AND ${orderDate} <= ?
  `,
    [startDate, endDate]
  );

  const completedCount = await execScalar(
    db,
    `
    SELECT COUNT(*) AS c FROM orders o
    WHERE o.status = 'completed'
      AND o.closed_at >= ? AND o.closed_at <= ?
  `,
    [closedFrom, endExclusive]
  );

  const cancelledCount = await execScalar(
    db,
    `
    SELECT COUNT(*) AS c FROM orders o
    WHERE o.status = 'cancelled'
      AND o.closed_at >= ? AND o.closed_at <= ?
  `,
    [closedFrom, endExclusive]
  );

  const totalRevenue = await execScalar(
    db,
    `
    SELECT COALESCE(SUM(o.total_price), 0) AS c FROM orders o
    WHERE o.status = 'completed'
      AND o.closed_at >= ? AND o.closed_at <= ?
  `,
    [closedFrom, endExclusive]
  );

  const avgCheck = completedCount > 0 ? round2(totalRevenue / completedCount) : 0;

  const cashIn = await execScalar(
    db,
    `
    SELECT
      COALESCE(SUM(CASE WHEN kind = 'payment' THEN amount ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN kind = 'refund' THEN amount ELSE 0 END), 0) AS c
    FROM payments
    WHERE paid_at >= ? AND paid_at <= ?
  `,
    [closedFrom, endExclusive]
  );

  return {
    totalOrders,
    totalRevenue: round2(totalRevenue),
    avgBookingValue: avgCheck,
    completedBookings: completedCount,
    cancelledBookings: cancelledCount,
    cashIn: round2(cashIn)
  };
}

async function getRevenueByDayInRange(db, startDate, endDate) {
  const closedDate = sqlDateOf(db.dialect, "o.closed_at");
  const rows = await db.query(
    `
    SELECT ${closedDate} AS day,
           COUNT(*) AS count,
           COALESCE(SUM(o.total_price), 0) AS revenue
    FROM orders o
    WHERE o.status = 'completed'
      AND o.closed_at >= ? AND o.closed_at <= ?
    GROUP BY ${closedDate}
    ORDER BY day
  `,
    [`${startDate} 00:00:00`, `${endDate}T23:59:59`]
  );
  return rows.map((r) => ({
    date: String(r.day).slice(0, 10),
    count: Number(r.count) || 0,
    revenue: round2(r.revenue)
  }));
}

async function getMonthlyComparison(db, months = 12) {
  const closedDate = sqlDateOf(db.dialect, "o.closed_at");
  const rows = await db.query(
    `
    SELECT strftime('%Y-%m', o.closed_at) AS month,
           COUNT(*) AS bookings,
           COALESCE(SUM(o.total_price), 0) AS revenue
    FROM orders o
    WHERE o.status = 'completed' AND o.closed_at IS NOT NULL
    GROUP BY strftime('%Y-%m', o.closed_at)
    ORDER BY month DESC
    LIMIT ?
  `,
    [months]
  );

  if (db.dialect === "postgres") {
    const pgRows = await db.query(
      `
      SELECT to_char(o.closed_at::timestamp, 'YYYY-MM') AS month,
             COUNT(*) AS bookings,
             COALESCE(SUM(o.total_price), 0) AS revenue
      FROM orders o
      WHERE o.status = 'completed' AND o.closed_at IS NOT NULL
      GROUP BY to_char(o.closed_at::timestamp, 'YYYY-MM')
      ORDER BY month DESC
      LIMIT ?
    `,
      [months]
    );
    return pgRows
      .reverse()
      .map((r) => ({
        month: r.month,
        bookings: Number(r.bookings) || 0,
        revenue: round2(r.revenue)
      }));
  }

  return rows
    .reverse()
    .map((r) => ({
      month: r.month,
      bookings: Number(r.bookings) || 0,
      revenue: round2(r.revenue)
    }));
}

async function getOrderHourDistribution(db, startDate, endDate) {
  const orderDate = orderDateSql(db.dialect);
  const hourExpr =
    db.dialect === "postgres"
      ? "CAST(NULLIF(split_part(o.start_time, ':', 1), '') AS INTEGER)"
      : "CAST(substr(o.start_time, 1, 2) AS INTEGER)";
  const rows = await db.query(
    `
    SELECT ${hourExpr} AS hour, COUNT(*) AS cnt
    FROM orders o
    WHERE o.status != 'cancelled'
      AND o.start_time IS NOT NULL AND o.start_time != ''
      AND ${orderDate} >= ? AND ${orderDate} <= ?
    GROUP BY hour
  `,
    [startDate, endDate]
  );

  const dist = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0 }));
  for (const r of rows) {
    const h = Number(r.hour);
    if (h >= 0 && h < 24) dist[h].count = Number(r.cnt) || 0;
  }
  return dist;
}

async function getRevenueByWorkType(db, startDate, endDate) {
  const rows = await db.query(
    `
    SELECT COALESCE(o.work_type, '—') AS category,
           COUNT(*) AS bookings_count,
           COALESCE(SUM(o.total_price), 0) AS revenue
    FROM orders o
    WHERE o.status = 'completed'
      AND o.closed_at >= ? AND o.closed_at <= ?
    GROUP BY o.work_type
    ORDER BY revenue DESC
  `,
    [`${startDate} 00:00:00`, `${endDate}T23:59:59`]
  );
  return rows.map((r) => ({
    category: r.category,
    bookings_count: Number(r.bookings_count) || 0,
    revenue: round2(r.revenue)
  }));
}

async function getStatusDistribution(db, startDate, endDate) {
  const orderDate = orderDateSql(db.dialect);
  const rows = await db.query(
    `
    SELECT o.status, COUNT(*) AS count
    FROM orders o
    WHERE ${orderDate} >= ? AND ${orderDate} <= ?
    GROUP BY o.status
    ORDER BY count DESC
  `,
    [startDate, endDate]
  );
  return rows.map((r) => ({
    status: r.status,
    label: statusLabel(r.status),
    count: Number(r.count) || 0
  }));
}

async function getPaymentDistribution(db, startDate, endDate) {
  const orders = await db.query(
    `
    SELECT o.id, o.total_price
    FROM orders o
    WHERE o.status = 'completed'
      AND o.closed_at >= ? AND o.closed_at <= ?
  `,
    [`${startDate} 00:00:00`, `${endDate}T23:59:59`]
  );

  const buckets = {
    paid: { label: "Оплачен полностью", count: 0, revenue: 0 },
    partial: { label: "Частично", count: 0, revenue: 0 },
    unpaid: { label: "Долг", count: 0, revenue: 0 }
  };

  for (const o of orders) {
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
    const total = Number(o.total_price) || 0;
    let key = "unpaid";
    if (paid >= total && total > 0) key = "paid";
    else if (paid > 0) key = "partial";
    buckets[key].count += 1;
    buckets[key].revenue = round2(buckets[key].revenue + total);
  }

  return Object.entries(buckets).map(([status, v]) => ({
    status,
    label: v.label,
    count: v.count,
    revenue: v.revenue
  }));
}

async function getTopClients(db, startDate, endDate, limit = 10) {
  const rows = await db.query(
    `
    SELECT c.full_name, COUNT(o.id) AS total_bookings, COALESCE(SUM(o.total_price), 0) AS total_spent
    FROM orders o
    JOIN cars car ON car.id = o.car_id
    JOIN clients c ON c.id = car.client_id
    WHERE o.status = 'completed'
      AND o.closed_at >= ? AND o.closed_at <= ?
    GROUP BY c.id, c.full_name
    ORDER BY total_spent DESC
    LIMIT ?
  `,
    [`${startDate} 00:00:00`, `${endDate}T23:59:59`, limit]
  );
  return rows.map((r) => ({
    full_name: r.full_name,
    total_bookings: Number(r.total_bookings) || 0,
    total_spent: round2(r.total_spent)
  }));
}

async function loadAnalyticsBundle(db, startDate, endDate) {
  const { loadTopServices } = require("./finance");
  const [
    overview,
    revenueByDay,
    revenueByCategory,
    topServices,
    topClients,
    statusDist,
    paymentDist,
    monthlyComparison,
    orderHourDist
  ] = await Promise.all([
    getOverview(db, startDate, endDate),
    getRevenueByDayInRange(db, startDate, endDate),
    getRevenueByWorkType(db, startDate, endDate),
    loadTopServices(db, startDate, endDate, 10),
    getTopClients(db, startDate, endDate, 10),
    getStatusDistribution(db, startDate, endDate),
    getPaymentDistribution(db, startDate, endDate),
    getMonthlyComparison(db, 12),
    getOrderHourDistribution(db, startDate, endDate)
  ]);

  return {
    overview,
    revenueByDay,
    revenueByCategory,
    topServices: topServices.map((s) => ({
      name: s.name,
      times_booked: Number(s.cnt) || 0,
      revenue: round2(s.revenue)
    })),
    topClients,
    statusDist,
    paymentDist,
    monthlyComparison,
    orderHourDist
  };
}

module.exports = {
  isIsoDate,
  resolveReportRange,
  getOverview,
  getRevenueByDayInRange,
  getMonthlyComparison,
  getOrderHourDistribution,
  getRevenueByWorkType,
  getStatusDistribution,
  getPaymentDistribution,
  getTopClients,
  loadAnalyticsBundle
};
