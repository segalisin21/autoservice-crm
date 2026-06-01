const { getDB } = require("../config/database");
const { loadTopServices } = require("../lib/finance");
const {
  resolveReportRange,
  loadAnalyticsBundle,
  isIsoDate
} = require("../lib/analytics");

const jsonForScript = (obj) => JSON.stringify(obj).replace(/</g, "\\u003c");

async function index(req, res) {
  const db = await getDB();
  const range = resolveReportRange(req.query);
  const bundle = await loadAnalyticsBundle(db, range.startDate, range.endDate);

  res.render("admin/reports", {
    period: range.period,
    startDate: range.startDate,
    endDate: range.endDate,
    overview: bundle.overview,
    revenueByDay: jsonForScript(bundle.revenueByDay),
    monthlyComparison: jsonForScript(bundle.monthlyComparison),
    revenueByCategoryJson: jsonForScript(bundle.revenueByCategory),
    statusDistJson: jsonForScript(bundle.statusDist),
    paymentDistJson: jsonForScript(bundle.paymentDist),
    topServicesJson: jsonForScript(bundle.topServices),
    orderHourDistJson: jsonForScript(bundle.orderHourDist),
    revenueByCategory: bundle.revenueByCategory,
    statusDist: bundle.statusDist,
    topServices: bundle.topServices,
    topClients: bundle.topClients,
    user: req.session.user,
    category: "reports",
    adminSection: "reports"
  });
}

async function apiData(req, res) {
  const db = await getDB();
  const range = resolveReportRange(req.query);
  const bundle = await loadAnalyticsBundle(db, range.startDate, range.endDate);
  res.json({
    ...bundle,
    range: { startDate: range.startDate, endDate: range.endDate }
  });
}

async function exportCsv(req, res) {
  const db = await getDB();
  const type = String(req.query.type ?? "finance");
  const startDate = req.query.start_date;
  const endDate = req.query.end_date;
  const dateRangeOk = startDate && endDate && isIsoDate(startDate) && isIsoDate(endDate);

  const bom = "\uFEFF";
  const sep = ";";

  if (type === "orders" && dateRangeOk) {
    const rows = await db.query(
      `
      SELECT o.id, o.status, o.work_type, o.scheduled_date, o.total_price, o.closed_at,
             c.full_name AS client_name, car.license_plate_raw
      FROM orders o
      JOIN cars car ON car.id = o.car_id
      JOIN clients c ON c.id = car.client_id
      WHERE o.closed_at >= ? AND o.closed_at <= ?
      ORDER BY o.closed_at DESC
    `,
      [`${startDate} 00:00:00`, `${endDate}T23:59:59`]
    );
    const lines = [["ID", "Статус", "Тип работ", "Дата", "Сумма", "Закрыт", "Клиент", "Госномер"].join(sep)];
    for (const r of rows) {
      lines.push(
        [
          r.id,
          r.status,
          r.work_type,
          r.scheduled_date,
          r.total_price,
          r.closed_at,
          `"${String(r.client_name).replace(/"/g, '""')}"`,
          r.license_plate_raw
        ].join(sep)
      );
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=orders-${startDate}.csv`);
    return res.send(bom + lines.join("\n"));
  }

  if (type === "top_services" && dateRangeOk) {
    const rows = await loadTopServices(db, startDate, endDate, 100);
    const lines = [["Услуга", "Кол-во", "Выручка"].join(sep)];
    for (const r of rows) {
      lines.push([`"${String(r.name).replace(/"/g, '""')}"`, r.cnt, r.revenue].join(sep));
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=top-services-${startDate}.csv`);
    return res.send(bom + lines.join("\n"));
  }

  if (type === "masters" && dateRangeOk) {
    const { getMasterRevenue } = require("../lib/analytics");
    const rows = await getMasterRevenue(db, startDate, endDate, 100);
    const lines = [["Мастер", "Строк работ", "Выручка работ", "Начислено ЗП"].join(sep)];
    for (const r of rows) {
      lines.push(
        [`"${String(r.master_name).replace(/"/g, '""')}"`, r.lines_count, r.revenue, r.payroll].join(sep)
      );
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=masters-${startDate}.csv`);
    return res.send(bom + lines.join("\n"));
  }

  if (type === "work_types" && dateRangeOk) {
    const { getRevenueByWorkType } = require("../lib/analytics");
    const rows = await getRevenueByWorkType(db, startDate, endDate);
    const lines = [["Тип работ", "Заказов", "Выручка"].join(sep)];
    for (const r of rows) {
      lines.push([r.category, r.bookings_count, r.revenue].join(sep));
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=work-types-${startDate}.csv`);
    return res.send(bom + lines.join("\n"));
  }

  if (type === "receivables") {
    const { getOrdersWithReceivables } = require("../lib/analytics");
    const rows = await getOrdersWithReceivables(db, 500);
    const lines = [["Заказ", "Клиент", "Госномер", "Статус", "Дата", "Итого", "Оплачено", "Долг"].join(sep)];
    for (const r of rows) {
      lines.push(
        [
          r.order_id,
          `"${String(r.client_name).replace(/"/g, '""')}"`,
          r.license_plate_raw || "",
          r.status,
          r.scheduled_date || "",
          r.total_price,
          r.paid,
          r.due
        ].join(sep)
      );
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=receivables.csv");
    return res.send(bom + lines.join("\n"));
  }

  if (type === "finance" && dateRangeOk) {
    const { loadFinanceMetrics } = require("../lib/finance");
    const m = await loadFinanceMetrics(db, startDate, endDate);
    const lines = [
      ["Показатель", "Значение"].join(sep),
      ["Касса", m.cash_in].join(sep),
      ["Выручка", m.net_revenue].join(sep),
      ["Расходники", m.materials_total].join(sep),
      ["ЗП", m.payroll_total].join(sep),
      ["Прибыль", m.net_profit].join(sep),
      ["Дебиторка", m.receivables].join(sep)
    ];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=finance-${startDate}.csv`);
    return res.send(bom + lines.join("\n"));
  }

  return res.status(400).send("Укажите type и даты");
}

module.exports = { index, apiData, exportCsv };
