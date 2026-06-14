const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { createTestApp } = require("./helpers/testApp");

async function seedOrder(ctx) {
  await ctx.db.query(
    `INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('RBAC Client', '+7', '79990000100')`
  );
  const clientId = (await ctx.db.query("SELECT id FROM clients ORDER BY id DESC LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO cars(client_id, make, model, license_plate_raw) VALUES (?, 'BMW', 'X5', 'A111AA77')`, [
    clientId
  ]);
  const carId = (await ctx.db.query("SELECT id FROM cars ORDER BY id DESC LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO orders(car_id, status, notes) VALUES (?, 'in_progress', 'old note')`, [carId]);
  return (await ctx.db.query("SELECT id FROM orders ORDER BY id DESC LIMIT 1"))[0].id;
}

test("master: calendar ok, orders list redirects, annotate notes, no line mutate", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const orderId = await seedOrder(ctx);
  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "master", "master");

  assert.equal((await agent.get("/")).status, 200);
  const listRes = await agent.get("/orders");
  assert.equal(listRes.status, 302);
  assert.match(listRes.headers.location, /\/?$/);

  const showRes = await agent.get(`/orders/${orderId}`);
  assert.equal(showRes.status, 200);
  assert.match(showRes.text, /Комментарий и фото/);

  const notesRes = await agent.post(`/orders/${orderId}/notes`).type("form").send({ notes: "master note" });
  assert.equal(notesRes.status, 302);
  const order = (await ctx.db.query("SELECT notes FROM orders WHERE id = ?", [orderId]))[0];
  assert.equal(order.notes, "master note");

  const lineRes = await agent.post(`/orders/${orderId}/lines`).type("form").send({
    line_type: "work",
    name: "Test work",
    quantity: "1",
    unit_price: "100"
  });
  assert.equal(lineRes.status, 403);

  assert.equal((await agent.get("/clients")).status, 403);
  assert.equal((await agent.get("/admin/payroll")).status, 200);
});

test("manager: clients and orders mutate, no journal or finance", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(
    `INSERT INTO catalog_items(type, category, name, default_price, unit) VALUES ('work', 'ТО', 'Service', 1000, 'шт')`
  );
  const orderId = await seedOrder(ctx);
  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "manager", "manager");

  assert.equal((await agent.get("/clients")).status, 200);
  assert.equal((await agent.get("/journal")).status, 403);
  assert.equal((await agent.get("/admin/finance")).status, 403);
  assert.equal((await agent.get("/admin/payroll")).status, 403);

  await ctx.db.query(
    `INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('New', '+7', '79990000101')`
  );
  const clientId = (await ctx.db.query("SELECT id FROM clients ORDER BY id DESC LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO cars(client_id) VALUES (?)`, [clientId]);
  const carId = (await ctx.db.query("SELECT id FROM cars ORDER BY id DESC LIMIT 1"))[0].id;

  const createRes = await agent.post("/orders").type("form").send({ car_id: String(carId), notes: "mgr" });
  assert.equal(createRes.status, 302);

  const catId = (await ctx.db.query("SELECT id FROM catalog_items LIMIT 1"))[0].id;
  const lineRes = await agent.post(`/orders/${orderId}/lines`).type("form").send({
    line_type: "work",
    catalog_item_id: String(catId),
    quantity: "1",
    unit_price: "500",
    master_id: String(ctx.users.master.id)
  });
  assert.equal(lineRes.status, 302);

  const statusRes = await agent.post(`/orders/${orderId}/status`).type("form").send({ status: "ready" });
  assert.equal(statusRes.status, 302);
  const order = (await ctx.db.query("SELECT status FROM orders WHERE id = ?", [orderId]))[0];
  assert.equal(order.status, "ready");
});

test("manager cannot annotate-only route without permission gap on full update", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const orderId = await seedOrder(ctx);
  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "manager", "manager");

  const updateRes = await agent.put(`/orders/${orderId}`).type("form").send({
    notes: "mgr full",
    scheduled_date: "2026-06-15",
    assigned_user_id: String(ctx.users.master.id),
    discount_type: "none",
    discount_value: "0",
    work_type: "Электрика"
  });
  assert.equal(updateRes.status, 302);
});
