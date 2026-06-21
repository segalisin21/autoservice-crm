const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { createTestApp } = require("./helpers/testApp");
const { hashPassword } = require("../lib/password");
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

test("override form applies same rule to multiple masters", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(
    `INSERT INTO users(username, password_hash, name, role, is_active, show_in_schedule) VALUES ('m2', ?, 'Master Two', 'master', 1, 1)`,
    [hashPassword("m2")]
  );
  const master2Id = (await ctx.db.query("SELECT id FROM users WHERE username = 'm2'"))[0].id;
  await ctx.db.query(`INSERT INTO catalog_items(type, category, name, default_price) VALUES ('work', 'T', 'Brakes', 2000)`);
  const catalogId = (await ctx.db.query("SELECT id FROM catalog_items WHERE name = 'Brakes'"))[0].id;

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "owner", "owner");
  const res = await agent.post("/admin/payroll/overrides").type("form").send({
    "user_ids[]": [String(ctx.users.master.id), String(master2Id)],
    catalog_item_id: String(catalogId),
    mode: "fixed",
    value: "800"
  });
  assert.equal(res.status, 302);

  const rows = await ctx.db.query(
    "SELECT user_id, mode, value FROM master_comp_overrides WHERE catalog_item_id = ? ORDER BY user_id",
    [catalogId]
  );
  assert.equal(rows.length, 2);
  for (const row of rows) {
    assert.equal(row.mode, "fixed");
    assert.equal(Number(row.value), 800);
  }
});

async function seedSplitPayrollOrder(ctx, { master1Id, master2Id, catalogId, closedAt = "2026-06-10 12:00:00" }) {
  await ctx.db.query(
    `INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('C', '1', '79991110000')`
  );
  const clientId = (await ctx.db.query("SELECT id FROM clients LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO cars(client_id) VALUES (?)`, [clientId]);
  const carId = (await ctx.db.query("SELECT id FROM cars LIMIT 1"))[0].id;
  await ctx.db.query(
    `INSERT INTO orders(car_id, status, closed_at, total_price) VALUES (?, 'completed', ?, 3000)`,
    [carId, closedAt]
  );
  const orderId = (await ctx.db.query("SELECT id FROM orders LIMIT 1"))[0].id;
  await ctx.db.query(
    `INSERT INTO order_lines(order_id, line_type, catalog_item_id, name, quantity, unit_price, total, master_id, work_status)
     VALUES (?, 'work', ?, 'Anti-rain', 1, 3000, 3000, ?, 'done')`,
    [orderId, catalogId, master1Id]
  );
  const lineId = (await ctx.db.query("SELECT id FROM order_lines WHERE order_id = ?", [orderId]))[0].id;
  await ctx.db.query(`INSERT INTO order_line_payroll(order_line_id, user_id, share_percent) VALUES (?, ?, 50)`, [
    lineId,
    master1Id
  ]);
  await ctx.db.query(`INSERT INTO order_line_payroll(order_line_id, user_id, share_percent) VALUES (?, ?, 50)`, [
    lineId,
    master2Id
  ]);
  await freezeOrderEarned(orderId);
  return { orderId, lineId };
}

test("split payroll balances show 500 each not 1000 for primary master", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const master1Id = ctx.users.master.id;
  await ctx.db.query(
    `INSERT INTO users(username, password_hash, name, role, is_active, show_in_schedule) VALUES ('m2', ?, 'Master Two', 'master', 1, 1)`,
    [hashPassword("m2")]
  );
  const master2Id = (await ctx.db.query("SELECT id FROM users WHERE username = 'm2'"))[0].id;
  await ctx.db.query(
    `INSERT INTO catalog_items(type, category, name, default_price, payroll_fixed) VALUES ('work', 'T', 'Anti-rain', 3000, 1000)`
  );
  const catalogId = (await ctx.db.query("SELECT id FROM catalog_items WHERE name = 'Anti-rain'"))[0].id;

  await seedSplitPayrollOrder(ctx, { master1Id, master2Id, catalogId });

  const { loadMasterPayrollBalances, loadMasterEarnedLines, sumEarnedForUser } = require("../lib/payrollBalance");
  const { payrollTotalInPeriod } = require("../lib/orderEconomics");

  const b1 = await sumEarnedForUser(ctx.db, master1Id);
  const b2 = await sumEarnedForUser(ctx.db, master2Id);
  assert.equal(b1, 500);
  assert.equal(b2, 500);

  const balances = await loadMasterPayrollBalances(ctx.db, {});
  const row1 = balances.find((b) => b.id === master1Id);
  const row2 = balances.find((b) => b.id === master2Id);
  assert.equal(row1.earned_total, 500);
  assert.equal(row2.earned_total, 500);

  const lines1 = await loadMasterEarnedLines(ctx.db, master1Id);
  const lines2 = await loadMasterEarnedLines(ctx.db, master2Id);
  assert.equal(lines1.length, 1);
  assert.equal(lines2.length, 1);
  assert.equal(Number(lines1[0].earned), 500);
  assert.equal(Number(lines2[0].earned), 500);

  const periodTotal = await payrollTotalInPeriod(ctx.db, "2026-06-01", "2026-06-30");
  assert.equal(periodTotal, 1000);
});

test("admin can deactivate master comp rule via delete", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const masterId = ctx.users.master.id;
  await ctx.db.query(
    `INSERT INTO master_comp_rules(user_id, mode, value, effective_from, is_active) VALUES (?, 'percent', 15, '2026-01-01', 1)`,
    [masterId]
  );
  const ruleId = (await ctx.db.query("SELECT id FROM master_comp_rules LIMIT 1"))[0].id;

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");

  const res = await agent.delete(`/admin/payroll/rules/${ruleId}`);
  assert.equal(res.status, 302);
  assert.match(res.headers.location, /\/admin\/payroll/);

  const row = (await ctx.db.query("SELECT is_active FROM master_comp_rules WHERE id = ?", [ruleId]))[0];
  assert.equal(Number(row.is_active), 0);
});
