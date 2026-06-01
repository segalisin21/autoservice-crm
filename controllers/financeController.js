const { getDB } = require("../config/database");
const { parseDateRange, loadFinanceMetrics, loadTopServices } = require("../lib/finance");
const { loadOrdersEconomicsInPeriod } = require("../lib/orderEconomics");

async function finance(req, res) {
  const db = await getDB();
  const range = parseDateRange(req.query);
  const metrics = await loadFinanceMetrics(db, range.start_date, range.end_date);
  const orderEconomics = await loadOrdersEconomicsInPeriod(db, range.start_date, range.end_date);

  res.render("admin/finance", {
    metrics,
    orderEconomics,
    range,
    user: req.session.user
  });
}

async function reports(req, res) {
  const db = await getDB();
  const range = parseDateRange(req.query);
  const metrics = await loadFinanceMetrics(db, range.start_date, range.end_date);
  const topServices = await loadTopServices(db, range.start_date, range.end_date);

  res.render("admin/reports", {
    metrics,
    topServices,
    range,
    user: req.session.user
  });
}

async function exportCsv(req, res) {
  const db = await getDB();
  const range = parseDateRange(req.query);
  const type = String(req.query.type ?? "summary");
  const metrics = await loadFinanceMetrics(db, range.start_date, range.end_date);

  if (type === "top_services") {
    const rows = await loadTopServices(db, range.start_date, range.end_date, 100);
    const lines = ["name,count,revenue"];
    for (const r of rows) {
      lines.push(`"${String(r.name).replace(/"/g, '""')}",${r.cnt},${r.revenue}`);
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="top-services-${range.start_date}.csv"`);
    return res.send(lines.join("\n"));
  }

  const lines = [
    "metric,value",
    `cash_in,${metrics.cash_in}`,
    `orders_net_by_closed_at,${metrics.orders_net_by_closed_at}`,
    `gross_revenue,${metrics.gross_revenue}`,
    `discounts_total,${metrics.discounts_total}`,
    `net_revenue,${metrics.net_revenue}`,
    `expenses_total,${metrics.expenses_total}`,
    `net_profit,${metrics.net_profit}`,
    `taxes_total,${metrics.taxes_total}`,
    `receivables,${metrics.receivables}`
  ];
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="finance-${range.start_date}.csv"`);
  return res.send(lines.join("\n"));
}

module.exports = { finance, reports, exportCsv };
