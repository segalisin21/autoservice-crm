const { getDB } = require("../config/database");
const { sqlDateOf } = require("../config/sqlDialect");
const { getPaidAmount } = require("../lib/orderTotals");
const { WORK_TYPES } = require("../lib/workTypes");
const { likePattern, likePatternFolded, lcLike, ciLike } = require("../lib/sqlSearch");

async function index(req, res) {
  const db = await getDB();
  const openedDate = sqlDateOf(db.dialect, "o.opened_at");
  const start = String(req.query.start_date ?? "").slice(0, 10);
  const end = String(req.query.end_date ?? "").slice(0, 10);
  const work_type = String(req.query.work_type ?? "").trim();
  const search = String(req.query.search ?? "").trim();

  const where = [];
  const params = [];
  if (start) {
    where.push(`${openedDate} >= ?`);
    params.push(start);
  }
  if (end) {
    where.push(`${openedDate} <= ?`);
    params.push(end);
  }
  if (work_type) {
    where.push("(o.work_type = ? OR o.work_type LIKE ? OR o.work_type LIKE ? OR o.work_type LIKE ?)");
    params.push(work_type, `${work_type},%`, `%, ${work_type},%`, `%, ${work_type}`);
  }
  if (search) {
    where.push(
      `(${lcLike("ol.name_lc")} OR ${lcLike("c.make_lc")} OR c.license_plate_raw LIKE ? OR ${ciLike("u.name")})`
    );
    const like = likePatternFolded(search);
    params.push(like, like, likePattern(search), like);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const lines = await db.query(
    `
    SELECT
      ol.id AS line_id,
      o.id AS order_id,
      o.opened_at,
      o.work_type,
      COALESCE(c.make, c.license_plate_raw, '') AS car,
      COALESCE(u.name, '') AS master_name,
      ol.name AS service_name,
      ol.unit_price AS price,
      ol.line_type,
      o.notes AS order_note
    FROM order_lines ol
    JOIN orders o ON o.id = ol.order_id
    JOIN cars c ON c.id = o.car_id
    LEFT JOIN users u ON u.id = ol.master_id
    ${whereSql}
    ORDER BY o.opened_at DESC, ol.id DESC
    LIMIT 500
  `,
    params
  );

  const paidByOrder = new Map();
  for (const line of lines) {
    if (!paidByOrder.has(line.order_id)) {
      paidByOrder.set(line.order_id, await getPaidAmount(db, line.order_id));
    }
    line.payment = paidByOrder.get(line.order_id);
    line.show_payment = false;
  }
  const seenOrder = new Set();
  for (const line of lines) {
    if (!seenOrder.has(line.order_id)) {
      line.show_payment = true;
      seenOrder.add(line.order_id);
    }
  }

  let totals = { price: 0, payment: 0 };
  for (const line of lines) {
    totals.price += Number(line.price) || 0;
    if (line.show_payment) totals.payment += Number(line.payment) || 0;
  }

  res.render("journal/index", {
    lines,
    totals,
    filters: { start_date: start, end_date: end, work_type, search },
    workTypes: WORK_TYPES,
    user: req.session.user
  });
}

module.exports = { index };
