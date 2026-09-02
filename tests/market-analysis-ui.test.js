const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { createTestApp } = require("./helpers/testApp");
const { filterMarketData, SERVICE_GROUP_IDS } = require("../lib/marketAnalysis");

test("GET /admin/market renders market dashboard for owner", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "owner", "owner");
  const res = await agent.get("/admin/market");
  assert.equal(res.status, 200);
  assert.match(res.text, /admin-page--market/);
  assert.match(res.text, /marketFilter/);
  assert.match(res.text, /marketPositionChart/);
  assert.match(res.text, /market-chart-type/);
  assert.match(res.text, /market-chart-toolbar/);
  assert.match(res.text, /market-kpi-card/);
  assert.match(res.text, /Анализ рынка/);
  assert.match(res.text, /MARKET_BOOTSTRAP/);
  assert.match(res.text, /Услуги CRM против рынка/);
  assert.doesNotMatch(res.text, /beltPriceChart/);
});

test("master cannot access market analysis", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "master", "master");
  assert.equal((await agent.get("/admin/market")).status, 403);
  assert.equal((await agent.get("/admin/market/api/data")).status, 403);
});

test("GET /admin/market/api/data filters by service group", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "owner", "owner");
  const res = await agent.get("/admin/market/api/data?service=wash&geography=all");
  assert.equal(res.status, 200);

  const body = res.body;
  assert.equal(body.service, "wash");
  assert.ok(Array.isArray(body.rows));
  assert.ok(body.rows.length > 0);
  assert.ok(body.rows.every((row) => row.group === "wash"));
  assert.ok(Array.isArray(body.serviceGroups));
  assert.equal(body.serviceGroups.length, SERVICE_GROUP_IDS.length);
  assert.equal(typeof body.kpi.matched, "number");
  assert.equal(typeof body.kpi.notInCatalog, "number");
  assert.equal(body.chart.labels.length, body.chart.ourPrices.length);
  assert.equal(typeof body.chart.shown, "number");
  assert.equal(typeof body.chart.total, "number");
  assert.ok(body.chart.shown <= 12);
});

test("unknown service filter falls back to all", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "owner", "owner");
  const res = await agent.get("/admin/market/api/data?service=belts");
  assert.equal(res.status, 200);
  assert.equal(res.body.service, "all");
});

test("filterMarketData geography=local hides other geographies", () => {
  const data = filterMarketData({ service: "all", geography: "local" });
  assert.equal(data.geography, "local");
  assert.ok(data.rows.length > 0);
  assert.ok(data.rows.every((row) => row.geography === "local"));
  assert.ok(data.priceAdvice.length > 0);
  assert.ok(data.niches.length > 0);
});

test("every benchmark row uses a known group and geography", () => {
  const data = filterMarketData({ service: "all", geography: "all" });
  const geos = ["local", "nearby", "major"];
  for (const row of data.rows) {
    assert.ok(SERVICE_GROUP_IDS.includes(row.group), `bad group: ${row.group}`);
    assert.ok(geos.includes(row.geography), `bad geography: ${row.geography}`);
    assert.ok(row.typicalLow <= row.typicalHigh, `bad band: ${row.name}`);
    assert.ok(row.min <= row.typicalLow, `min above band: ${row.name}`);
    assert.ok(row.high >= row.typicalHigh, `high below band: ${row.name}`);
  }
});
