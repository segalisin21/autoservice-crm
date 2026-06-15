const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { createTestApp } = require("./helpers/testApp");
const { loadOrderEconomics } = require("../lib/orderEconomics");
const { onOrderStatusChange } = require("../lib/payroll");

test("loadOrderEconomics computes profit after order completed", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(
    `INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('T', '1', '79990000020')`
  );
  const clientId = (await ctx.db.query("SELECT id FROM clients LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO cars(client_id) VALUES (?)`, [clientId]);
  const carId = (await ctx.db.query("SELECT id FROM cars LIMIT 1"))[0].id;
  await ctx.db.query(
    `INSERT INTO orders(car_id, status, total_price, subtotal_works, subtotal_products) VALUES (?, 'scheduled', 0, 0, 0)`,
    [carId]
  );
  const orderId = (await ctx.db.query("SELECT id FROM orders LIMIT 1"))[0].id;
  const masterId = ctx.users.master.id;

  await ctx.db.query(
    `INSERT INTO order_lines(order_id, line_type, name, quantity, unit_price, total, master_id, work_status, cost_price)
     VALUES (?, 'work', 'W', 1, 2000, 2000, ?, 'pending', 0)`,
    [orderId, masterId]
  );
  await ctx.db.query(
    `INSERT INTO order_lines(order_id, line_type, name, quantity, unit_price, total, cost_price)
     VALUES (?, 'product', 'P', 1, 500, 500, 200)`,
    [orderId]
  );
  await ctx.db.query(`UPDATE orders SET total_price = 2500, subtotal_works = 2000, subtotal_products = 500 WHERE id = ?`, [
    orderId
  ]);

  await ctx.db.query(`UPDATE orders SET status = 'completed', closed_at = '2026-06-01 12:00:00' WHERE id = ?`, [orderId]);
  await onOrderStatusChange(orderId, "scheduled", "completed");

  const economics = await loadOrderEconomics(ctx.db, orderId);
  assert.equal(economics.revenue, 2500);
  assert.equal(economics.materials, 200);
  assert.ok(economics.payroll > 0);
  assert.equal(economics.profit, economics.revenue - economics.materials - economics.payroll);
});

test("scheduled order shows payroll estimate", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(
    `INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('T', '1', '79990000022')`
  );
  const clientId = (await ctx.db.query("SELECT id FROM clients LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO cars(client_id) VALUES (?)`, [clientId]);
  const carId = (await ctx.db.query("SELECT id FROM cars LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO orders(car_id, status, total_price) VALUES (?, 'scheduled', 1000)`, [carId]);
  const orderId = (await ctx.db.query("SELECT id FROM orders LIMIT 1"))[0].id;
  await ctx.db.query(
    `INSERT INTO order_lines(order_id, line_type, name, quantity, unit_price, total, master_id, work_status)
     VALUES (?, 'work', 'W', 1, 1000, 1000, ?, 'pending')`,
    [orderId, ctx.users.master.id]
  );

  const economics = await loadOrderEconomics(ctx.db, orderId);
  assert.ok(economics.is_estimate);
  assert.ok(economics.payroll > 0);
});

test("master order page hides economics block", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(
    `INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('T', '1', '79990000021')`
  );
  const clientId = (await ctx.db.query("SELECT id FROM clients LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO cars(client_id) VALUES (?)`, [clientId]);
  const carId = (await ctx.db.query("SELECT id FROM cars LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO orders(car_id, total_price) VALUES (?, 1000)`, [carId]);
  const orderId = (await ctx.db.query("SELECT id FROM orders LIMIT 1"))[0].id;

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "master", "master");
  const res = await agent.get(`/orders/${orderId}`);
  assert.equal(res.status, 200);
  assert.ok(!res.text.includes("economics-strip"));
});

test("owner can open orders economics dashboard", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(
    `INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('Econ', '1', '79990000099')`
  );
  const clientId = (await ctx.db.query("SELECT id FROM clients LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO cars(client_id, make, model) VALUES (?, 'VW', 'Polo')`, [clientId]);
  const carId = (await ctx.db.query("SELECT id FROM cars LIMIT 1"))[0].id;
  await ctx.db.query(
    `INSERT INTO orders(car_id, status, total_price, closed_at) VALUES (?, 'completed', 1000, datetime('now'))`,
    [carId]
  );

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "owner", "owner");
  const res = await agent.get("/admin/orders-economics?period=month&status=completed");
  assert.equal(res.status, 200);
  assert.match(res.text, /Экономика/);
  assert.match(res.text, /order-econ-table/);
  assert.ok(!res.text.includes("order-econ-card"));
});
