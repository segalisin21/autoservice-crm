const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { createTestApp } = require("./helpers/testApp");
const { freezeOrderEarned } = require("../lib/payroll");
const { loadFinanceMetrics } = require("../lib/finance");

async function seedOrderWithWorkLine(ctx, { masterId, catalogId, lineTotal, status }) {
  await ctx.db.query(
    `INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('C', '1', '79991110000')`
  );
  const clientId = (await ctx.db.query("SELECT id FROM clients LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO cars(client_id) VALUES (?)`, [clientId]);
  const carId = (await ctx.db.query("SELECT id FROM cars LIMIT 1"))[0].id;
  await ctx.db.query(
    `INSERT INTO orders(car_id, status, closed_at, total_price) VALUES (?, ?, datetime('now'), ?)`,
    [carId, status, lineTotal]
  );
  const orderId = (await ctx.db.query("SELECT id FROM orders LIMIT 1"))[0].id;
  await ctx.db.query(
    `
    INSERT INTO order_lines(order_id, line_type, catalog_item_id, name, quantity, unit_price, total, master_id, work_status)
    VALUES (?, 'work', ?, 'Service', 1, ?, ?, ?, 'done')
  `,
    [orderId, catalogId, lineTotal, lineTotal, masterId]
  );
  return orderId;
}

test("override percent applied when order completed", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const masterId = ctx.users.master.id;
  await ctx.db.query(
    `INSERT INTO catalog_items(type, category, name, default_price) VALUES ('work', 'T', 'Oil', 1000)`
  );
  const catalogId = (await ctx.db.query("SELECT id FROM catalog_items LIMIT 1"))[0].id;

  await ctx.db.query(
    `INSERT INTO master_comp_rules(user_id, mode, value, is_active) VALUES (?, 'percent', 10, 1)`,
    [masterId]
  );
  await ctx.db.query(
    `INSERT INTO master_comp_overrides(user_id, catalog_item_id, mode, value) VALUES (?, ?, 'percent', 25)`,
    [masterId, catalogId]
  );

  const orderId = await seedOrderWithWorkLine(ctx, {
    masterId,
    catalogId,
    lineTotal: 1000,
    status: "completed"
  });
  await freezeOrderEarned(orderId);

  const line = (await ctx.db.query("SELECT master_earned_amount, master_comp_value FROM order_lines WHERE order_id=?", [
    orderId
  ]))[0];
  assert.equal(Number(line.master_comp_value), 25);
  assert.equal(Number(line.master_earned_amount), 250);
});

test("changing rules after close does not change earned", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const masterId = ctx.users.master.id;
  await ctx.db.query(
    `INSERT INTO master_comp_rules(user_id, mode, value, is_active) VALUES (?, 'percent', 10, 1)`,
    [masterId]
  );

  const orderId = await seedOrderWithWorkLine(ctx, {
    masterId,
    catalogId: null,
    lineTotal: 1000,
    status: "completed"
  });
  await freezeOrderEarned(orderId);

  await ctx.db.query(
    `INSERT INTO master_comp_rules(user_id, mode, value, is_active) VALUES (?, 'percent', 50, 1)`,
    [masterId]
  );
  await freezeOrderEarned(orderId);

  const line = (await ctx.db.query("SELECT master_earned_amount FROM order_lines WHERE order_id=?", [orderId]))[0];
  assert.equal(Number(line.master_earned_amount), 100);
});

test("finance net_profit subtracts payroll and materials", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const orderId = await seedOrderWithWorkLine(ctx, {
    masterId: ctx.users.master.id,
    catalogId: null,
    lineTotal: 1000,
    status: "completed"
  });
  await ctx.db.query(
    `UPDATE orders SET closed_at = '2026-06-01 12:00:00', total_price = 1000, subtotal_works = 1000 WHERE id = ?`,
    [orderId]
  );
  const { freezeOrderEarned } = require("../lib/payroll");
  await freezeOrderEarned(orderId);

  const metrics = await loadFinanceMetrics(ctx.db, "2026-06-01", "2026-06-15");
  assert.ok(metrics.payroll_total > 0);
  assert.ok(metrics.net_profit < metrics.net_revenue);
});

test("finance cash_in sums payments in period", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const orderId = await seedOrderWithWorkLine(ctx, {
    masterId: ctx.users.master.id,
    catalogId: null,
    lineTotal: 500,
    status: "in_progress"
  });
  const today = new Date().toISOString().slice(0, 10);
  await ctx.db.query(
    `INSERT INTO payments(order_id, amount, method, kind, paid_at) VALUES (?, 300, 'cash', 'payment', ?)`,
    [orderId, `${today} 12:00:00`]
  );

  const metrics = await loadFinanceMetrics(ctx.db, today, today);
  assert.equal(metrics.cash_in, 300);
});

test("master cannot access finance reports", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "master", "master");
  const res = await agent.get("/admin/finance");
  assert.equal(res.status, 403);
});

test("master can view own payroll summary", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "master", "master");
  const res = await agent.get("/admin/payroll");
  assert.equal(res.status, 200);
  assert.match(res.text, /Зарплата/);
});

test("payroll balance shows due after partial payout", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const masterId = ctx.users.master.id;
  const orderId = await seedOrderWithWorkLine(ctx, {
    masterId,
    catalogId: null,
    lineTotal: 1000,
    status: "completed"
  });
  await ctx.db.query(
    `UPDATE orders SET closed_at = '2026-06-01 12:00:00', total_price = 1000, subtotal_works = 1000 WHERE id = ?`,
    [orderId]
  );
  const { freezeOrderEarned } = require("../lib/payroll");
  await freezeOrderEarned(orderId);

  const { loadMasterPayrollBalances } = require("../lib/payrollBalance");
  let balances = await loadMasterPayrollBalances(ctx.db, {});
  let row = balances.find((b) => b.id === masterId);
  assert.ok(row.earned_total > 0);
  assert.equal(row.due_total, row.earned_total);

  await ctx.db.query(
    `INSERT INTO payouts(user_id, amount, paid_at, note) VALUES (?, 100, '2026-06-02 10:00:00', 'test')`,
    [masterId]
  );
  balances = await loadMasterPayrollBalances(ctx.db, {});
  row = balances.find((b) => b.id === masterId);
  assert.equal(row.paid_total, 100);
  assert.equal(row.due_total, row.earned_total - 100);
});

test("payroll page shows expandable master accordion", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "owner", "owner");
  const res = await agent.get("/admin/payroll");
  assert.equal(res.status, 200);
  assert.match(res.text, /payroll-accordion/);
  assert.match(res.text, /Начисления по работам/);
});

test("admin can record payroll payout", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");
  const res = await agent.post("/admin/payroll/payouts").type("form").send({
    user_id: String(ctx.users.master.id),
    amount: "50",
    paid_at: "2026-06-02",
    note: "advance"
  });
  assert.equal(res.status, 302);

  const paid = await ctx.db.query("SELECT SUM(amount) AS s FROM payouts WHERE user_id = ?", [
    ctx.users.master.id
  ]);
  assert.equal(Number(paid[0].s), 50);
});
