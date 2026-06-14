const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { createTestApp } = require("./helpers/testApp");
const { minimalOrderPayload } = require("./helpers/orderCreate");
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

  const createOrder = await agent.post("/orders").type("form").send(minimalOrderPayload(ctx, { car_id: String(carId), notes: "" }));
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
  await agent.post("/orders").type("form").send(minimalOrderPayload(ctx, { car_id: String(carId), notes: "" }));
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

test("completed order page shows status chips for admin", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(
    `INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('T', '1', '79990000012')`
  );
  const clientId = (await ctx.db.query("SELECT id FROM clients LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO cars(client_id) VALUES (?)`, [clientId]);
  const carId = (await ctx.db.query("SELECT id FROM cars LIMIT 1"))[0].id;
  await ctx.db.query(
    `INSERT INTO orders(car_id, status, closed_at, total_price) VALUES (?, 'completed', datetime('now'), 100)`,
    [carId]
  );
  const orderId = (await ctx.db.query("SELECT id FROM orders LIMIT 1"))[0].id;

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");
  const res = await agent.get(`/orders/${orderId}`);
  assert.equal(res.status, 200);
  assert.match(res.text, /status-chip-form/);
  assert.match(res.text, /status-chip active/);
});

test("admin can reopen completed order", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(
    `INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('T', '1', '79990000013')`
  );
  const clientId = (await ctx.db.query("SELECT id FROM clients ORDER BY id DESC LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO cars(client_id) VALUES (?)`, [clientId]);
  const carId = (await ctx.db.query("SELECT id FROM cars ORDER BY id DESC LIMIT 1"))[0].id;
  await ctx.db.query(
    `INSERT INTO orders(car_id, status, closed_at, total_price) VALUES (?, 'completed', datetime('now'), 100)`,
    [carId]
  );
  const orderId = (await ctx.db.query("SELECT id FROM orders ORDER BY id DESC LIMIT 1"))[0].id;

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");
  const res = await agent.post(`/orders/${orderId}/status`).type("form").send({ status: "in_progress" });
  assert.equal(res.status, 302);

  const order = (await ctx.db.query("SELECT status, closed_at FROM orders WHERE id = ?", [orderId]))[0];
  assert.equal(order.status, "in_progress");
  assert.equal(order.closed_at, null);
});

test("master cannot change completed order status", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(
    `INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('T', '1', '79990000014')`
  );
  const clientId = (await ctx.db.query("SELECT id FROM clients ORDER BY id DESC LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO cars(client_id) VALUES (?)`, [clientId]);
  const carId = (await ctx.db.query("SELECT id FROM cars ORDER BY id DESC LIMIT 1"))[0].id;
  await ctx.db.query(
    `INSERT INTO orders(car_id, status, closed_at, total_price) VALUES (?, 'completed', datetime('now'), 100)`,
    [carId]
  );
  const orderId = (await ctx.db.query("SELECT id FROM orders ORDER BY id DESC LIMIT 1"))[0].id;

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "master", "master");
  const page = await agent.get(`/orders/${orderId}`);
  assert.equal(page.status, 200);
  assert.ok(!page.text.includes("status-chip-form"));

  const res = await agent.post(`/orders/${orderId}/status`).type("form").send({ status: "in_progress" });
  assert.equal(res.status, 403);

  const order = (await ctx.db.query("SELECT status FROM orders WHERE id = ?", [orderId]))[0];
  assert.equal(order.status, "completed");
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

test("add line from catalog with vehicle_tier sets price and description snapshot", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(
    `INSERT INTO catalog_items(type, category, name, article, description, default_price, price_tier_2, price_tier_3, is_active)
     VALUES ('work', 'Мойка', 'Комплекс Тест', 'W-TIER1', '• пункт один\n• пункт два', 5000, 5500, 6000, 1)`
  );
  const catId = (await ctx.db.query("SELECT id FROM catalog_items WHERE article = 'W-TIER1'"))[0].id;

  const { agent, orderId } = await seedOrderWithAgent(ctx);
  const res = await agent.post(`/orders/${orderId}/lines`).type("form").send({
    line_type: "work",
    catalog_item_id: String(catId),
    vehicle_tier: "2",
    quantity: "1"
  });
  assert.equal(res.status, 302);

  const line = (await ctx.db.query("SELECT * FROM order_lines WHERE order_id = ? ORDER BY id DESC LIMIT 1", [orderId]))[0];
  assert.equal(line.name, "Комплекс Тест");
  assert.equal(Number(line.unit_price), 5500);
  assert.equal(line.vehicle_tier, 2);
  assert.match(line.notes, /пункт один/);
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

test("admin can delete order and related lines", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const { agent, orderId, catId } = await seedOrderWithAgent(ctx);
  await agent.post(`/orders/${orderId}/lines`).type("form").send({
    line_type: "work",
    catalog_item_id: String(catId),
    quantity: "1"
  });
  await agent.post(`/orders/${orderId}/payments`).type("form").send({ amount: "100", method: "cash" });

  const del = await agent.post(`/orders/${orderId}?_method=DELETE`);
  assert.equal(del.status, 302);
  assert.match(del.headers.location, /\/orders$/);

  const rows = await ctx.db.query("SELECT id FROM orders WHERE id = ?", [orderId]);
  assert.equal(rows.length, 0);
  const lines = await ctx.db.query("SELECT id FROM order_lines WHERE order_id = ?", [orderId]);
  assert.equal(lines.length, 0);
  const payments = await ctx.db.query("SELECT id FROM payments WHERE order_id = ?", [orderId]);
  assert.equal(payments.length, 0);
});

test("manager can delete order", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(
    `INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('T', '1', '79990000099')`
  );
  const clientId = (await ctx.db.query("SELECT id FROM clients ORDER BY id DESC LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO cars(client_id) VALUES (?)`, [clientId]);
  const carId = (await ctx.db.query("SELECT id FROM cars ORDER BY id DESC LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO orders(car_id, status) VALUES (?, 'scheduled')`, [carId]);
  const orderId = (await ctx.db.query("SELECT id FROM orders ORDER BY id DESC LIMIT 1"))[0].id;

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "manager", "manager");
  const del = await agent.post(`/orders/${orderId}?_method=DELETE`);
  assert.equal(del.status, 302);
  assert.equal((await ctx.db.query("SELECT id FROM orders WHERE id = ?", [orderId])).length, 0);
});

test("master cannot delete order", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(
    `INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('T', '1', '79990000098')`
  );
  const clientId = (await ctx.db.query("SELECT id FROM clients ORDER BY id DESC LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO cars(client_id) VALUES (?)`, [clientId]);
  const carId = (await ctx.db.query("SELECT id FROM cars ORDER BY id DESC LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO orders(car_id, status) VALUES (?, 'scheduled')`, [carId]);
  const orderId = (await ctx.db.query("SELECT id FROM orders ORDER BY id DESC LIMIT 1"))[0].id;

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "master", "master");
  const del = await agent.post(`/orders/${orderId}?_method=DELETE`);
  assert.equal(del.status, 403);
  assert.equal((await ctx.db.query("SELECT id FROM orders WHERE id = ?", [orderId])).length, 1);
});

test("order mileage saves to car and appears on print", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(
    `INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('Mile', '+7', '79990000097')`
  );
  const clientId = (await ctx.db.query("SELECT id FROM clients ORDER BY id DESC LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO cars(client_id, make, model) VALUES (?, 'Toyota', 'Camry')`, [clientId]);
  const carId = (await ctx.db.query("SELECT id FROM cars ORDER BY id DESC LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO orders(car_id, status) VALUES (?, 'in_progress')`, [carId]);
  const orderId = (await ctx.db.query("SELECT id FROM orders ORDER BY id DESC LIMIT 1"))[0].id;

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");

  const save = await agent.post(`/orders/${orderId}/mileage`).type("form").send({ mileage: "125500" });
  assert.equal(save.status, 302);

  const car = (await ctx.db.query("SELECT mileage FROM cars WHERE id = ?", [carId]))[0];
  assert.equal(Number(car.mileage), 125500);

  const print = await agent.get(`/orders/${orderId}/print`);
  assert.equal(print.status, 200);
  assert.match(print.text, /125[\s\u00a0]?500/);
});

test("order card update sets start and end time without work type", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(
    `INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('Sched', '+7', '79990000098')`
  );
  const clientId = (await ctx.db.query("SELECT id FROM clients ORDER BY id DESC LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO cars(client_id, make) VALUES (?, 'Kia')`, [clientId]);
  const carId = (await ctx.db.query("SELECT id FROM cars ORDER BY id DESC LIMIT 1"))[0].id;
  await ctx.db.query(
    `INSERT INTO orders(car_id, status, scheduled_date, work_type) VALUES (?, 'scheduled', '2026-06-20', NULL)`,
    [carId]
  );
  const orderId = (await ctx.db.query("SELECT id FROM orders ORDER BY id DESC LIMIT 1"))[0].id;

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");

  const res = await agent.put(`/orders/${orderId}`).type("form").send({
    scheduled_date: "2026-06-20",
    start_time: "11:30",
    end_time: "13:00",
    assigned_user_id: String(ctx.users.master.id),
    discount_type: "none",
    discount_value: "0",
    work_type: "",
    notes: ""
  });
  assert.equal(res.status, 302);
  assert.doesNotMatch(res.headers.location, /work_type_error=1/);

  const order = (await ctx.db.query("SELECT start_time, end_time FROM orders WHERE id = ?", [orderId]))[0];
  assert.equal(order.start_time, "11:30");
  assert.equal(order.end_time, "13:00");
});
