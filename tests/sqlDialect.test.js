const test = require("node:test");
const assert = require("node:assert/strict");
const { sqlNow, sqlDateOf, orderDateSql, sqlMonthYmd } = require("../config/sqlDialect");

test("sqlNow returns dialect-specific timestamp expression", () => {
  assert.match(sqlNow("sqlite"), /datetime\('now'\)/);
  assert.match(sqlNow("postgres"), /NOW\(\)/);
});

test("sqlDateOf extracts date from opened_at column", () => {
  assert.equal(sqlDateOf("sqlite", "o.opened_at"), "date(o.opened_at)");
  assert.match(sqlDateOf("postgres", "o.opened_at"), /opened_at/);
});

test("orderDateSql prefers scheduled_date over opened_at date", () => {
  assert.match(orderDateSql("sqlite"), /scheduled_date/);
  assert.match(orderDateSql("postgres"), /scheduled_date/);
});

test("sqlMonthYmd uses strftime on sqlite and to_char on postgres", () => {
  assert.match(sqlMonthYmd("sqlite", "o.closed_at"), /strftime/);
  assert.match(sqlMonthYmd("postgres", "o.closed_at"), /to_char/);
  assert.doesNotMatch(sqlMonthYmd("postgres", "o.closed_at"), /strftime/);
});
