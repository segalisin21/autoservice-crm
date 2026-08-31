const { orderDateSql } = require("../config/sqlDialect");
const { normalizePlate } = require("./normalize");
const { likePattern, likePatternFolded, lcLike } = require("./sqlSearch");
const { PAID_AMOUNT_SUBQUERY } = require("./receivables");

const PAGE_SIZE = 50;

function parseOptionalId(raw) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseDateFilter(raw) {
  const s = String(raw ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

function parseOrdersListFilters(query) {
  return {
    status: String(query.status ?? "").trim(),
    search: String(query.search ?? "").trim(),
    assigned_user_id: parseOptionalId(query.assigned_user_id),
    due_only: query.due_only === "1" || query.due_only === "true",
    date_from: parseDateFilter(query.date_from),
    date_to: parseDateFilter(query.date_to),
    page: Math.max(1, Number(query.page) || 1)
  };
}

function buildOrdersListWhere(db, filters) {
  const where = [];
  const params = [];
  const orderDateExpr = orderDateSql(db.dialect);

  if (filters.status) {
    where.push("o.status = ?");
    params.push(filters.status);
  }
  if (filters.assigned_user_id) {
    where.push("o.assigned_user_id = ?");
    params.push(filters.assigned_user_id);
  }
  if (filters.date_from) {
    where.push(`${orderDateExpr} >= ?`);
    params.push(filters.date_from);
  }
  if (filters.date_to) {
    where.push(`${orderDateExpr} <= ?`);
    params.push(filters.date_to);
  }
  if (filters.search) {
    const plateNorm = normalizePlate(filters.search).license_plate_normalized;
    const digits = filters.search.replace(/\D/g, "");
    if (plateNorm) {
      where.push(
        `(c.license_plate_normalized LIKE ? OR ${lcLike("cl.full_name_lc")} OR cl.phone_normalized LIKE ? OR CAST(o.id AS TEXT) LIKE ?)`
      );
      params.push(`%${plateNorm}%`, likePatternFolded(filters.search), `%${digits || filters.search}%`, likePattern(filters.search));
    } else {
      where.push(
        `(${lcLike("cl.full_name_lc")} OR cl.phone_normalized LIKE ? OR c.license_plate_normalized LIKE ? OR CAST(o.id AS TEXT) LIKE ?)`
      );
      params.push(
        likePatternFolded(filters.search),
        `%${digits || filters.search}%`,
        `%${filters.search.toUpperCase().replace(/[\s-]/g, "")}%`,
        likePattern(filters.search)
      );
    }
  }
  if (filters.due_only) {
    where.push("o.status NOT IN ('cancelled')");
    where.push(`o.total_price > ${PAID_AMOUNT_SUBQUERY}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return { whereSql, params, orderDateExpr };
}

function buildOrdersListQuery(filters, page, overrides = {}) {
  const f = { ...filters, ...overrides };
  const q = {};
  if (f.search) q.search = f.search;
  if (f.status) q.status = f.status;
  if (f.assigned_user_id) q.assigned_user_id = String(f.assigned_user_id);
  if (f.due_only) q.due_only = "1";
  if (f.date_from) q.date_from = f.date_from;
  if (f.date_to) q.date_to = f.date_to;
  if (page && page > 1) q.page = String(page);
  const qs = new URLSearchParams(q).toString();
  return qs ? `?${qs}` : "";
}

module.exports = {
  PAGE_SIZE,
  parseOrdersListFilters,
  buildOrdersListWhere,
  buildOrdersListQuery,
  parseDateFilter
};
