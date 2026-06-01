const PG_NOW = "to_char(NOW(), 'YYYY-MM-DD HH24:MI:SS')";
const SQLITE_NOW = "datetime('now')";

function sqlNow(dialect) {
  return dialect === "postgres" ? PG_NOW : SQLITE_NOW;
}

function sqlDateOf(dialect, columnSql) {
  if (dialect === "postgres") return `(${columnSql}::timestamp)::date`;
  return `date(${columnSql})`;
}

function orderDateSql(dialect) {
  if (dialect === "postgres") {
    return "COALESCE(o.scheduled_date, (o.opened_at::timestamp)::date::text)";
  }
  return "COALESCE(o.scheduled_date, date(o.opened_at))";
}

/** Year-month bucket for analytics (e.g. closed_at → '2026-06'). */
function sqlMonthYmd(dialect, columnSql) {
  if (dialect === "postgres") {
    return `to_char(${columnSql}::timestamp, 'YYYY-MM')`;
  }
  return `strftime('%Y-%m', ${columnSql})`;
}

module.exports = { sqlNow, sqlDateOf, orderDateSql, sqlMonthYmd };
