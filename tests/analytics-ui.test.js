const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { createTestApp } = require("./helpers/testApp");
const { resolveReportRange, loadAnalyticsBundle } = require("../lib/analytics");

test("GET /admin/finance renders Belka-style KPI cards", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "owner", "owner");
  const res = await agent.get("/admin/finance?period=month");
  assert.equal(res.status, 200);
  assert.match(res.text, /finance-kpi-card/);
  assert.match(res.text, /finance-subnav/);
  assert.match(res.text, /finance-dashboard/);
});

test("GET /admin/reports renders analytics dashboard", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "owner", "owner");
  const res = await agent.get("/admin/reports?period=30");
  assert.equal(res.status, 200);
  assert.match(res.text, /admin-page--reports/);
  assert.match(res.text, /revenueChart/);
  assert.match(res.text, /Аналитика/);
});

test("GET /admin/reports/api/data returns overview and series", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "owner", "owner");
  const res = await agent.get("/admin/reports/api/data?period=7");
  assert.equal(res.status, 200);
  const body = res.body;
  assert.ok(body.overview);
  assert.ok(Array.isArray(body.revenueByDay));
  assert.ok(Array.isArray(body.statusDist));
  assert.ok(body.range.startDate);
});

test("master cannot access analytics", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "master", "master");
  assert.equal((await agent.get("/admin/reports")).status, 403);
});

test("getPaymentDistribution buckets paid partial unpaid", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const { getPaymentDistribution } = require("../lib/analytics");
  await ctx.db.query(
    `INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('P', '1', '79990000099')`
  );
  const clientId = (await ctx.db.query("SELECT id FROM clients LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO cars(client_id) VALUES (?)`, [clientId]);
  const carId = (await ctx.db.query("SELECT id FROM cars LIMIT 1"))[0].id;

  await ctx.db.query(
    `INSERT INTO orders(car_id, status, closed_at, total_price) VALUES (?, 'completed', '2026-06-05 12:00:00', 1000)`,
    [carId]
  );
  const o1 = (await ctx.db.query("SELECT id FROM orders ORDER BY id DESC LIMIT 1"))[0].id;
  await ctx.db.query(
    `INSERT INTO orders(car_id, status, closed_at, total_price) VALUES (?, 'completed', '2026-06-05 14:00:00', 500)`,
    [carId]
  );
  const o2 = (await ctx.db.query("SELECT id FROM orders ORDER BY id DESC LIMIT 1"))[0].id;

  await ctx.db.query(
    `INSERT INTO payments(order_id, amount, method, kind, paid_at) VALUES (?, 1000, 'cash', 'payment', '2026-06-05 12:00:00')`,
    [o1]
  );
  await ctx.db.query(
    `INSERT INTO payments(order_id, amount, method, kind, paid_at) VALUES (?, 200, 'cash', 'payment', '2026-06-05 14:00:00')`,
    [o2]
  );

  const dist = await getPaymentDistribution(ctx.db, "2026-06-05", "2026-06-05");
  const paid = dist.find((d) => d.status === "paid");
  const partial = dist.find((d) => d.status === "partial");
  assert.equal(paid.count, 1);
  assert.equal(partial.count, 1);
});

test("getMonthlyComparison works on sqlite without strftime in postgres path", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(
    `INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('M', '1', '79990000088')`
  );
  const clientId = (await ctx.db.query("SELECT id FROM clients LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO cars(client_id) VALUES (?)`, [clientId]);
  const carId = (await ctx.db.query("SELECT id FROM cars LIMIT 1"))[0].id;
  await ctx.db.query(
    `INSERT INTO orders(car_id, status, closed_at, total_price) VALUES (?, 'completed', '2026-06-10 12:00:00', 100)`,
    [carId]
  );

  const { getMonthlyComparison } = require("../lib/analytics");
  const months = await getMonthlyComparison(ctx.db, 12);
  assert.ok(months.some((m) => String(m.month).includes("2026-06")));
});

test("loadAnalyticsBundle returns numeric overview", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const range = resolveReportRange({ period: "30" });
  const bundle = await loadAnalyticsBundle(ctx.db, range.startDate, range.endDate);
  assert.equal(typeof bundle.overview.totalOrders, "number");
  assert.ok(Array.isArray(bundle.revenueByCategory));
});
