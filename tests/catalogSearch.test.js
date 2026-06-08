const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { createTestApp } = require("./helpers/testApp");

test("catalog search API finds active items", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(
    `INSERT INTO catalog_items(type, category, name, default_price, unit, is_active) VALUES ('work', 'Мойка', 'ТехМойка', 500, 'шт', 1)`
  );

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");

  const res = await agent.get("/api/catalog/search?q=Мойка&type=work&category=Мойка");
  assert.equal(res.status, 200);
  assert.equal(res.body.items.length, 1);
  assert.equal(res.body.items[0].name, "ТехМойка");
  assert.equal(Number(res.body.items[0].default_price), 500);
});

test("catalog search requires auth", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const res = await request(ctx.app).get("/api/catalog/search?q=x");
  assert.equal(res.status, 302);
});
