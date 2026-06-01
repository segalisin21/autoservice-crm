const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { createTestApp } = require("./helpers/testApp");
const { recomputeOrderTotals } = require("../lib/orderTotals");

test("create order, add work line, totals recalculated", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(
    `INSERT INTO catalog_items(type, category, name, default_price, unit) VALUES ('work', 'ТО', 'Замена масла', 1500, 'шт')`
  );
  await ctx.db.query(
    `INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('Test', '+7', '79990000000')`
  );
  const clientId = (await ctx.db.query("SELECT id FROM clients LIMIT 1"))[0].id;
  await ctx.db.query(
    `INSERT INTO cars(client_id, make, model) VALUES (?, 'VW', 'Polo')`,
    [clientId]
  );
  const carId = (await ctx.db.query("SELECT id FROM cars LIMIT 1"))[0].id;

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");

  const createOrder = await agent.post("/orders").type("form").send({ car_id: String(carId), notes: "" });
  assert.equal(createOrder.status, 302);
  const orderId = (await ctx.db.query("SELECT id FROM orders ORDER BY id DESC LIMIT 1"))[0].id;

  const catId = (await ctx.db.query("SELECT id FROM catalog_items LIMIT 1"))[0].id;
  await agent.post(`/orders/${orderId}/lines`).type("form").send({
    line_type: "work",
    catalog_item_id: String(catId),
    quantity: "2",
    unit_price: ""
  });

  const order = (await ctx.db.query("SELECT subtotal_works, total_price FROM orders WHERE id = ?", [orderId]))[0];
  assert.equal(Number(order.subtotal_works), 3000);
  assert.equal(Number(order.total_price), 3000);
});

test("discount percent works_only reduces only works subtotal", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(
    `INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('T', '1', '79990000001')`
  );
  const clientId = (await ctx.db.query("SELECT id FROM clients LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO cars(client_id) VALUES (?)`, [clientId]);
  const carId = (await ctx.db.query("SELECT id FROM cars LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO orders(car_id, status) VALUES (?, 'scheduled')`, [carId]);
  const orderId = (await ctx.db.query("SELECT id FROM orders LIMIT 1"))[0].id;

  await ctx.db.query(
    `INSERT INTO order_lines(order_id, line_type, name, quantity, unit_price, total) VALUES (?, 'work', 'W', 1, 1000, 1000)`,
    [orderId]
  );
  await ctx.db.query(
    `INSERT INTO order_lines(order_id, line_type, name, quantity, unit_price, total) VALUES (?, 'product', 'P', 1, 500, 500)`,
    [orderId]
  );

  await ctx.db.query(
    `UPDATE orders SET discount_type='percent', discount_value=10, discount_scope='works_only' WHERE id=?`,
    [orderId]
  );
  await recomputeOrderTotals(orderId);

  const order = (await ctx.db.query("SELECT discount_amount, total_price FROM orders WHERE id=?", [orderId]))[0];
  assert.equal(Number(order.discount_amount), 100);
  assert.equal(Number(order.total_price), 1400);
});

test("tax with prices_include_tax=0 adds tax to total", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(`UPDATE settings SET value='1' WHERE key='tax_enabled'`);
  await ctx.db.query(`UPDATE settings SET value='20' WHERE key='tax_rate'`);
  await ctx.db.query(`UPDATE settings SET value='0' WHERE key='prices_include_tax'`);

  await ctx.db.query(
    `INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('T', '1', '79990000002')`
  );
  const clientId = (await ctx.db.query("SELECT id FROM clients LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO cars(client_id) VALUES (?)`, [clientId]);
  const carId = (await ctx.db.query("SELECT id FROM cars LIMIT 1"))[0].id;
  await ctx.db.query(
    `INSERT INTO orders(car_id, tax_enabled, tax_rate, prices_include_tax) VALUES (?, 1, 20, 0)`,
    [carId]
  );
  const orderId = (await ctx.db.query("SELECT id FROM orders LIMIT 1"))[0].id;
  await ctx.db.query(
    `INSERT INTO order_lines(order_id, line_type, name, quantity, unit_price, total) VALUES (?, 'work', 'W', 1, 1000, 1000)`,
    [orderId]
  );
  await recomputeOrderTotals(orderId);

  const order = (await ctx.db.query("SELECT tax_amount, total_price FROM orders WHERE id=?", [orderId]))[0];
  assert.equal(Number(order.tax_amount), 200);
  assert.equal(Number(order.total_price), 1200);
});

test("payment reduces due amount", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(
    `INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('T', '1', '79990000003')`
  );
  const clientId = (await ctx.db.query("SELECT id FROM clients LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO cars(client_id) VALUES (?)`, [clientId]);
  const carId = (await ctx.db.query("SELECT id FROM cars LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO orders(car_id, total_price) VALUES (?, 1000)`, [carId]);
  const orderId = (await ctx.db.query("SELECT id FROM orders LIMIT 1"))[0].id;

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");
  await agent.post(`/orders/${orderId}/payments`).type("form").send({ amount: "400", method: "cash", kind: "payment" });

  const { getPaidAmount } = require("../lib/orderTotals");
  const paid = await getPaidAmount(ctx.db, orderId);
  assert.equal(paid, 400);
});
