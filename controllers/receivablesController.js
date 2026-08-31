const { getDB } = require("../config/database");
const { loadReceivablesPage, loadAllReceivables } = require("../lib/receivables");
const { ORDER_STATUS_LABELS } = require("../lib/orderStatusLabels");

async function index(req, res) {
  const db = await getDB();
  const page = Math.max(1, Number(req.query.page) || 1);
  const data = await loadReceivablesPage(db, { page, pageSize: 50 });

  res.render("admin/receivables", {
    items: data.items,
    page: data.page,
    totalPages: data.totalPages,
    totalCount: data.totalCount,
    pageSize: data.pageSize,
    grandTotalDue: data.grandTotalDue,
    statusLabels: ORDER_STATUS_LABELS,
    user: req.session.user,
    category: "finance",
    adminSection: "receivables"
  });
}

async function exportCsv(req, res) {
  const db = await getDB();
  const rows = await loadAllReceivables(db);
  const bom = "\uFEFF";
  const sep = ";";
  const lines = [["Заказ", "Клиент", "Телефон", "Госномер", "Статус", "Дата", "Итого", "Оплачено", "Долг"].join(sep)];
  for (const r of rows) {
    lines.push(
      [
        r.order_id,
        `"${String(r.client_name || "").replace(/"/g, '""')}"`,
        r.client_phone || "",
        r.license_plate_raw || "",
        r.status,
        r.scheduled_date || String(r.opened_at || "").slice(0, 10),
        r.total_price.toFixed(2),
        r.paid.toFixed(2),
        r.due.toFixed(2)
      ].join(sep)
    );
  }
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="receivables.csv"');
  return res.send(bom + lines.join("\n"));
}

module.exports = { index, exportCsv };
