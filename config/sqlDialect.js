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

module.exports = { sqlNow, sqlDateOf, orderDateSql };
