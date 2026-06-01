const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { createTestApp } = require("./helpers/testApp");
const { loadFinanceMetrics } = require("../lib/finance");

test("admin can create expense and it affects finance metrics", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");

  const today = new Date().toISOString().slice(0, 10);
  const res = await agent.post("/expenses").type("form").send({
    expense_date: today,
    category: "purchase",
    amount: "1500",
    payment_method: "cash",
    vendor: "Поставщик"
  });
  assert.equal(res.status, 302);

  const rows = await ctx.db.query("SELECT COUNT(*) AS c FROM expenses");
  assert.equal(Number(rows[0].c), 1);

  const metrics = await loadFinanceMetrics(ctx.db, today, today);
  assert.equal(metrics.expenses_total, 1500);
  assert.equal(metrics.net_profit, metrics.net_revenue - 1500);
});

test("master cannot view expenses", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "master", "master");
  const res = await agent.get("/expenses");
  assert.equal(res.status, 403);
});
