const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { createTestApp } = require("./helpers/testApp");
const { telHref, whatsAppHref } = require("../lib/phoneLinks");

test("telHref and whatsAppHref normalize RU numbers", () => {
  assert.equal(telHref("+7 (999) 123-45-67"), "tel:+79991234567");
  assert.equal(whatsAppHref("89991234567"), "https://wa.me/79991234567");
  assert.equal(telHref(""), null);
});

test("GET /admin/receivables lists orders with balance", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(
    `INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('Debtor', '+79991234567', '79991234567')`
  );
  const clientId = (await ctx.db.query("SELECT id FROM clients ORDER BY id DESC LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO cars(client_id, license_plate_raw) VALUES (?, 'A111AA77')`, [clientId]);
  const carId = (await ctx.db.query("SELECT id FROM cars ORDER BY id DESC LIMIT 1"))[0].id;

  await ctx.db.query(`INSERT INTO orders(car_id, status, total_price) VALUES (?, 'completed', 2000)`, [carId]);
  const orderId = (await ctx.db.query("SELECT id FROM orders ORDER BY id DESC LIMIT 1"))[0].id;
  await ctx.db.query(
    `INSERT INTO payments(order_id, amount, method, kind, paid_at) VALUES (?, 500, 'cash', 'payment', datetime('now'))`,
    [orderId]
  );

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");
  const res = await agent.get("/admin/receivables");
  assert.equal(res.status, 200);
  assert.match(res.text, /Дебиторка/);
  assert.match(res.text, new RegExp(`/orders/${orderId}`));
  assert.match(res.text, /1\s?500\.00/);
  assert.match(res.text, /tel:\+79991234567/);
});

test("GET /orders/export.csv respects due_only filter", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(
    `INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('Csv', '1', '79990000444')`
  );
  const clientId = (await ctx.db.query("SELECT id FROM clients ORDER BY id DESC LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO cars(client_id) VALUES (?)`, [clientId]);
  const carId = (await ctx.db.query("SELECT id FROM cars ORDER BY id DESC LIMIT 1"))[0].id;

  await ctx.db.query(`INSERT INTO orders(car_id, status, total_price) VALUES (?, 'completed', 1000)`, [carId]);
  const dueId = (await ctx.db.query("SELECT id FROM orders ORDER BY id DESC LIMIT 1"))[0].id;
  await ctx.db.query(
    `INSERT INTO payments(order_id, amount, method, kind, paid_at) VALUES (?, 200, 'cash', 'payment', datetime('now'))`,
    [dueId]
  );
  await ctx.db.query(`INSERT INTO orders(car_id, status, total_price) VALUES (?, 'completed', 500)`, [carId]);
  const paidId = (await ctx.db.query("SELECT id FROM orders ORDER BY id DESC LIMIT 1"))[0].id;
  await ctx.db.query(
    `INSERT INTO payments(order_id, amount, method, kind, paid_at) VALUES (?, 500, 'cash', 'payment', datetime('now'))`,
    [paidId]
  );

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");
  const res = await agent.get("/orders/export.csv?due_only=1");
  assert.equal(res.status, 200);
  assert.match(res.headers["content-type"], /csv/);
  assert.match(res.text, new RegExp(`\\n${dueId};`));
  assert.doesNotMatch(res.text, new RegExp(`\\n${paidId};`));
});

test("order show renders clickable phone links", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(
    `INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('Phone', '+79990000555', '79990000555')`
  );
  const clientId = (await ctx.db.query("SELECT id FROM clients ORDER BY id DESC LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO cars(client_id) VALUES (?)`, [clientId]);
  const carId = (await ctx.db.query("SELECT id FROM cars ORDER BY id DESC LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO orders(car_id, status) VALUES (?, 'scheduled')`, [carId]);
  const orderId = (await ctx.db.query("SELECT id FROM orders ORDER BY id DESC LIMIT 1"))[0].id;

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");
  const res = await agent.get(`/orders/${orderId}`);
  assert.equal(res.status, 200);
  assert.match(res.text, /tel:\+79990000555/);
  assert.match(res.text, /wa\.me\/79990000555/);
});

test("dashboard finance labels distinguish month vs total debt", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");
  const res = await agent.get("/");
  assert.equal(res.status, 200);
  assert.match(res.text, /Выручка за месяц/);
  assert.match(res.text, /Долг клиентов \(всего\)/);
  assert.match(res.text, /\/admin\/receivables/);
});
