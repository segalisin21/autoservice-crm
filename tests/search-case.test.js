const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { createTestApp } = require("./helpers/testApp");
const { backfillSearchLc } = require("../lib/sqlSearch");

test("client list search is case-insensitive by name", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(
    `INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('Иванов Иван', '+7', '79991112233')`
  );
  await backfillSearchLc(ctx.db);

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");

  const res = await agent.get("/clients?search=иван");
  assert.equal(res.status, 200);
  assert.match(res.text, /Иванов Иван/);
});

test("GET /clients/search finds client regardless of case", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(
    `INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('Петров Пётр', '+7', '79992223344')`
  );
  await backfillSearchLc(ctx.db);

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");

  const res = await agent.get("/clients/search?q=петр");
  assert.equal(res.status, 200);
  const data = res.body;
  assert.ok(Array.isArray(data));
  assert.equal(data.length, 1);
  assert.equal(data[0].full_name, "Петров Пётр");
});

test("catalog search is case-insensitive by service name", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(
    `INSERT INTO catalog_items(type, category, name, article, default_price, is_active)
     VALUES ('work', 'Электрика', 'Комплекс Premium', 'W-001', 5000, 1)`
  );
  await backfillSearchLc(ctx.db);

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");

  const res = await agent.get("/api/catalog/search?q=комплекс&type=work");
  assert.equal(res.status, 200);
  assert.equal(res.body.items.length, 1);
  assert.equal(res.body.items[0].name, "Комплекс Premium");
});
