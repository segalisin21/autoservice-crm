const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { createTestApp } = require("./helpers/testApp");
const { filterMarketData } = require("../lib/marketAnalysis");

test("GET /admin/market renders market dashboard for owner", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "owner", "owner");
  const res = await agent.get("/admin/market");
  assert.equal(res.status, 200);
  assert.match(res.text, /admin-page--market/);
  assert.match(res.text, /marketFilter/);
  assert.match(res.text, /beltPriceChart/);
  assert.match(res.text, /Анализ рынка/);
  assert.match(res.text, /MARKET_BOOTSTRAP/);
});

test("master cannot access market analysis", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "master", "master");
  assert.equal((await agent.get("/admin/market")).status, 403);
  assert.equal((await agent.get("/admin/market/api/data")).status, 403);
});

test("GET /admin/market/api/data filters belts only", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "owner", "owner");
  const res = await agent.get("/admin/market/api/data?service=belts&geography=all");
  assert.equal(res.status, 200);
  const body = res.body;
  assert.equal(body.service, "belts");
  assert.ok(Array.isArray(body.priceRows));
  assert.ok(body.priceRows.every((row) => row.service === "belts"));
  assert.ok(Array.isArray(body.beltOffers));
  assert.ok(body.beltOffers.length > 0);
  assert.ok(body.beltChart.labels.length === body.beltOffers.length);
  assert.equal(body.kpi.directBeltOffers, 0);
});

test("filterMarketData geography=local hides russia-only price rows", () => {
  const data = filterMarketData({ service: "all", geography: "local" });
  assert.equal(data.geography, "local");
  assert.ok(data.priceRows.every((row) => row.geography === "local"));
  assert.ok(data.localCompetition.length > 0);
});
