const { getDB } = require("../config/database");
const { parseDateRange } = require("../lib/finance");
const { loadOrdersEconomicsInPeriod } = require("../lib/orderEconomics");
const { statusLabel, ORDER_STATUS_LABELS } = require("../lib/orderStatusLabels");

async function index(req, res) {
  const db = await getDB();
  const range = parseDateRange(req.query);
  const status = String(req.query.status ?? "completed").trim() || "completed";

  const orders = await loadOrdersEconomicsInPeriod(db, range.start_date, range.end_date, status);

  const totals = orders.reduce(
    (acc, o) => {
      acc.revenue += Number(o.revenue) || 0;
      acc.materials += Number(o.materials) || 0;
      acc.payroll += Number(o.payroll) || 0;
      acc.profit += Number(o.profit) || 0;
      return acc;
    },
    { revenue: 0, materials: 0, payroll: 0, profit: 0 }
  );

  res.render("admin/orders-economics", {
    orders,
    totals,
    range,
    status,
    statusLabel,
    statusLabels: ORDER_STATUS_LABELS,
    user: req.session.user,
    category: "finance",
    adminSection: "economics"
  });
}

module.exports = { index };
