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

test("loadAnalyticsBundle returns numeric overview", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const range = resolveReportRange({ period: "30" });
  const bundle = await loadAnalyticsBundle(ctx.db, range.startDate, range.endDate);
  assert.equal(typeof bundle.overview.totalOrders, "number");
  assert.ok(Array.isArray(bundle.revenueByCategory));
});
