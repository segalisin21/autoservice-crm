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

async function seedOrderWithAgent(ctx) {
  await ctx.db.query(
    `INSERT INTO catalog_items(type, category, name, default_price, unit) VALUES ('work', 'ТО', 'Работа', 3000, 'шт')`
  );
  await ctx.db.query(
    `INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('Test', '+7', '79990000010')`
  );
  const clientId = (await ctx.db.query("SELECT id FROM clients LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO cars(client_id, make, model) VALUES (?, 'VW', 'Polo')`, [clientId]);
  const carId = (await ctx.db.query("SELECT id FROM cars LIMIT 1"))[0].id;
  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");
  await agent.post("/orders").type("form").send({ car_id: String(carId), notes: "" });
  const orderId = (await ctx.db.query("SELECT id FROM orders ORDER BY id DESC LIMIT 1"))[0].id;
  const catId = (await ctx.db.query("SELECT id FROM catalog_items LIMIT 1"))[0].id;
  return { agent, orderId, catId };
}

test("add work line with empty master_id does not fail", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());
  const { agent, orderId, catId } = await seedOrderWithAgent(ctx);

  const res = await agent.post(`/orders/${orderId}/lines`).type("form").send({
    line_type: "work",
    catalog_item_id: String(catId),
    quantity: "1",
    master_id: ""
  });
  assert.equal(res.status, 302);

  const lines = await ctx.db.query(
    "SELECT master_id FROM order_lines WHERE order_id = ? AND line_type = 'work'",
    [orderId]
  );
  assert.equal(lines.length, 1);
  assert.equal(lines[0].master_id, null);
});

test("add work line with invalid master_id stores null not NaN", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());
  const { agent, orderId, catId } = await seedOrderWithAgent(ctx);

  const res = await agent.post(`/orders/${orderId}/lines`).type("form").send({
    line_type: "work",
    catalog_item_id: String(catId),
    quantity: "1",
    master_id: "abc"
  });
  assert.equal(res.status, 302);

  const lines = await ctx.db.query(
    "SELECT master_id FROM order_lines WHERE order_id = ? AND line_type = 'work'",
    [orderId]
  );
  assert.equal(lines.length, 1);
  assert.equal(lines[0].master_id, null);
});

test("add work line with two masters splits total across lines", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());
  const { agent, orderId, catId } = await seedOrderWithAgent(ctx);
  await ctx.db.query(
    `INSERT INTO users(username, password_hash, name, role, is_active) VALUES ('m2', 'x', 'Master Two', 'master', 1)`
  );
  const master2Id = (await ctx.db.query("SELECT id FROM users WHERE username = 'm2'"))[0].id;

  const res = await agent.post(`/orders/${orderId}/lines`).type("form").send({
    line_type: "work",
    catalog_item_id: String(catId),
    quantity: "1",
    unit_price: "3000",
    master_ids: [String(ctx.users.master.id), String(master2Id)]
  });
  assert.equal(res.status, 302);

  const lines = await ctx.db.query(
    "SELECT master_id, total FROM order_lines WHERE order_id = ? AND line_type = 'work' ORDER BY id",
    [orderId]
  );
  assert.equal(lines.length, 2);
  const sum = lines.reduce((s, l) => s + Number(l.total), 0);
  assert.equal(sum, 3000);

  const order = (await ctx.db.query("SELECT subtotal_works FROM orders WHERE id = ?", [orderId]))[0];
  assert.equal(Number(order.subtotal_works), 3000);
});

test("completed order page shows status badge not chips", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(
    `INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('T', '1', '79990000012')`
  );
  const clientId = (await ctx.db.query("SELECT id FROM clients LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO cars(client_id) VALUES (?)`, [clientId]);
  const carId = (await ctx.db.query("SELECT id FROM cars LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO orders(car_id, status, total_price) VALUES (?, 'completed', 100)`, [carId]);
  const orderId = (await ctx.db.query("SELECT id FROM orders LIMIT 1"))[0].id;

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");
  const res = await agent.get(`/orders/${orderId}`);
  assert.equal(res.status, 200);
  assert.match(res.text, /status-badge status-completed/);
  assert.ok(!res.text.includes('status-chip-form'));
});

test("update work line changes master and price", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());
  const { agent, orderId, catId } = await seedOrderWithAgent(ctx);

  await agent.post(`/orders/${orderId}/lines`).type("form").send({
    line_type: "work",
    catalog_item_id: String(catId),
    quantity: "1",
    unit_price: "3000",
    master_id: String(ctx.users.master.id)
  });

  const lineId = (
    await ctx.db.query("SELECT id FROM order_lines WHERE order_id = ? AND line_type = 'work' LIMIT 1", [orderId])
  )[0].id;

  await ctx.db.query(
    `INSERT INTO users(username, password_hash, name, role, is_active) VALUES ('m3', 'x', 'Other Master', 'master', 1)`
  );
  const otherMasterId = (await ctx.db.query("SELECT id FROM users WHERE username = 'm3'"))[0].id;

  const res = await agent
    .post(`/orders/lines/${lineId}?_method=PUT`)
    .type("form")
    .send({ quantity: "2", unit_price: "1500", master_id: String(otherMasterId) });
  assert.equal(res.status, 302);

  const line = (await ctx.db.query("SELECT master_id, total FROM order_lines WHERE id = ?", [lineId]))[0];
  assert.equal(line.master_id, otherMasterId);
  assert.equal(Number(line.total), 3000);
});

test("completed order line edit writes activity_logs", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());
  const { agent, orderId, catId } = await seedOrderWithAgent(ctx);

  await agent.post(`/orders/${orderId}/lines`).type("form").send({
    line_type: "work",
    catalog_item_id: String(catId),
    quantity: "1",
    unit_price: "1000",
    master_id: String(ctx.users.master.id)
  });
  const lineId = (
    await ctx.db.query("SELECT id FROM order_lines WHERE order_id = ? AND line_type = 'work' LIMIT 1", [orderId])
  )[0].id;
  await ctx.db.query(`UPDATE orders SET status = 'completed', closed_at = datetime('now') WHERE id = ?`, [orderId]);

  await agent
    .post(`/orders/lines/${lineId}?_method=PUT`)
    .type("form")
    .send({ quantity: "1", unit_price: "1100", master_id: String(ctx.users.master.id) });

  const logs = await ctx.db.query(
    "SELECT action, entity_type, entity_id FROM activity_logs WHERE entity_type = 'order_line' AND entity_id = ?",
    [lineId]
  );
  assert.equal(logs.length, 1);
  assert.equal(logs[0].action, "update");
});

test("orders list due_only shows orders with balance", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(
    `INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('A', '1', '79990000031')`
  );
  const clientId = (await ctx.db.query("SELECT id FROM clients LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO cars(client_id) VALUES (?)`, [clientId]);
  const carId = (await ctx.db.query("SELECT id FROM cars LIMIT 1"))[0].id;

  await ctx.db.query(
    `INSERT INTO orders(car_id, status, total_price) VALUES (?, 'completed', 1000)`,
    [carId]
  );
  const dueOrderId = (await ctx.db.query("SELECT id FROM orders ORDER BY id DESC LIMIT 1"))[0].id;
  await ctx.db.query(
    `INSERT INTO payments(order_id, amount, method, kind, paid_at) VALUES (?, 200, 'cash', 'payment', datetime('now'))`,
    [dueOrderId]
  );

  await ctx.db.query(`INSERT INTO orders(car_id, status, total_price) VALUES (?, 'completed', 500)`, [carId]);
  const paidOrderId = (await ctx.db.query("SELECT id FROM orders ORDER BY id DESC LIMIT 1"))[0].id;
  await ctx.db.query(
    `INSERT INTO payments(order_id, amount, method, kind, paid_at) VALUES (?, 500, 'cash', 'payment', datetime('now'))`,
    [paidOrderId]
  );

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");
  const res = await agent.get("/orders?due_only=1");
  assert.equal(res.status, 200);
  assert.match(res.text, /orders-table/);
  assert.match(res.text, new RegExp(`/orders/${dueOrderId}`));
  assert.match(res.text, /800\.00/);
  assert.doesNotMatch(res.text, new RegExp(`/orders/${paidOrderId}`));
});

test("orders list renders data table on mobile width markup", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");
  const res = await agent.get("/orders");
  assert.equal(res.status, 200);
  assert.match(res.text, /class="data-table orders-table"/);
  assert.ok(!res.text.includes("order-list-card"));
});
