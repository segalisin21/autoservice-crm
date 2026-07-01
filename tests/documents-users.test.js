const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { createTestApp } = require("./helpers/testApp");

async function seedOrder(ctx) {
  await ctx.db.query(`INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('Док','+7','79990002233')`);
  const clientId = (await ctx.db.query("SELECT id FROM clients LIMIT 1"))[0].id;
  await ctx.db.query(
    `INSERT INTO cars(client_id, make, model, license_plate_raw) VALUES (?, 'Ford', 'Focus', 'X001XX77')`,
    [clientId]
  );
  const carId = (await ctx.db.query("SELECT id FROM cars LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO orders(car_id, status) VALUES (?, 'in_progress')`, [carId]);
  return (await ctx.db.query("SELECT id FROM orders LIMIT 1"))[0].id;
}

test("print and acts render 200", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const orderId = await seedOrder(ctx);
  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");

  const print = await agent.get(`/orders/${orderId}/print`);
  assert.equal(print.status, 200);
  assert.match(print.text, /Заказ-наряд/);

  const acceptance = await agent.get(`/orders/${orderId}/act-acceptance`);
  assert.equal(acceptance.status, 200);
  assert.match(acceptance.text, /приёма-передачи/);

  const completion = await agent.get(`/orders/${orderId}/act-completion`);
  assert.equal(completion.status, 200);
  assert.match(completion.text, /выполненных работ/);
});

test("print shows line description not vehicle tier", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const orderId = await seedOrder(ctx);
  await ctx.db.query(
    `INSERT INTO order_lines(order_id, line_type, name, quantity, unit_price, total, notes, vehicle_tier)
     VALUES (?, 'work', 'Комплекс Премиум', 1, 5500, 5500, '• комплекс базовый', 2)`,
    [orderId]
  );

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");
  const print = await agent.get(`/orders/${orderId}/print`);
  assert.equal(print.status, 200);
  assert.match(print.text, /Комплекс Премиум/);
  assert.match(print.text, /комплекс базовый/);
  assert.doesNotMatch(print.text, /2 кат/i);
  assert.doesNotMatch(print.text, /vehicle_tier/i);
});

test("print page has editable fields and no catalog autocomplete", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const orderId = await seedOrder(ctx);
  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");

  const print = await agent.get(`/orders/${orderId}/print`);
  assert.equal(print.status, 200);
  assert.match(print.text, /order-print-form/);
  assert.match(print.text, /data-field="client_name"/);
  assert.match(print.text, /order-print-edit\.js/);
  assert.doesNotMatch(print.text, /data-catalog-ac/);
});

test("print snapshot save is independent from order lines", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const orderId = await seedOrder(ctx);
  await ctx.db.query(
    `INSERT INTO order_lines(order_id, line_type, name, quantity, unit_price, total) VALUES (?, 'work', 'Масло', 1, 1000, 1000)`,
    [orderId]
  );

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");

  const snapshot = {
    doc_date: "01 января 2026",
    client_name: "Печать-клиент",
    client_phone: "+7999",
    car_make: "BMW",
    car_model: "X5",
    car_year: "2020",
    license_plate: "A111AA77",
    vin: "VIN123",
    mileage: "50000",
    scheduled_date: "2026-01-01",
    scheduled_end_date: "",
    works: [{ name: "Кастомная работа", notes: "", quantity: "1", unit_price: "999.00", total: "999.00" }],
    products: [],
    subtotal_works: "999.00",
    subtotal_products: "0.00",
    discount_amount: "0.00",
    total_price: "999.00"
  };

  const save = await agent.post(`/orders/${orderId}/print`).type("form").send({ snapshot: JSON.stringify(snapshot) });
  assert.equal(save.status, 302);
  assert.match(save.headers.location, /saved=1/);

  await ctx.db.query(`UPDATE order_lines SET name = 'Другое в карточке' WHERE order_id = ?`, [orderId]);

  const print = await agent.get(`/orders/${orderId}/print`);
  assert.equal(print.status, 200);
  assert.match(print.text, /Кастомная работа/);
  assert.match(print.text, /Печать-клиент/);
  assert.doesNotMatch(print.text, /Другое в карточке/);
});

test("print reset reloads from order card", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const orderId = await seedOrder(ctx);
  await ctx.db.query(
    `INSERT INTO order_lines(order_id, line_type, name, quantity, unit_price, total) VALUES (?, 'work', 'Из карточки', 1, 500, 500)`,
    [orderId]
  );

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");

  const snapshot = {
    doc_date: "01 января 2026",
    client_name: "Временный",
    client_phone: "",
    car_make: "",
    car_model: "",
    car_year: "",
    license_plate: "",
    vin: "",
    mileage: "",
    scheduled_date: "",
    scheduled_end_date: "",
    works: [{ name: "Временная строка", notes: "", quantity: "1", unit_price: "1", total: "1" }],
    products: [],
    subtotal_works: "1.00",
    subtotal_products: "0.00",
    discount_amount: "0.00",
    total_price: "1.00"
  };
  await agent.post(`/orders/${orderId}/print`).type("form").send({ snapshot: JSON.stringify(snapshot) });

  const reset = await agent.post(`/orders/${orderId}/print/reset`);
  assert.equal(reset.status, 302);

  const print = await agent.get(`/orders/${orderId}/print`);
  assert.match(print.text, /Из карточки/);
  assert.doesNotMatch(print.text, /Временная строка/);
});

test("owner can create employee; master cannot access users", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const ownerAgent = request.agent(ctx.app);
  await ctx.loginAs(ownerAgent, "owner", "owner");
  const create = await ownerAgent.post("/admin/users").type("form").send({
    username: "newmaster",
    name: "Новый Мастер",
    role: "master",
    password: "secret"
  });
  assert.equal(create.status, 302);
  const created = await ctx.db.query("SELECT * FROM users WHERE username = 'newmaster'");
  assert.equal(created.length, 1);

  const masterAgent = request.agent(ctx.app);
  await ctx.loginAs(masterAgent, "master", "master");
  const denied = await masterAgent.get("/admin/users");
  assert.equal(denied.status, 403);
});

test("owner can delete unused employee; blocked when payroll exists", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const ownerAgent = request.agent(ctx.app);
  await ctx.loginAs(ownerAgent, "owner", "owner");

  const create = await ownerAgent.post("/admin/users").type("form").send({
    username: "deleteme",
    name: "Удаляемый",
    role: "master",
    password: "secret"
  });
  assert.equal(create.status, 302);
  const userId = (await ctx.db.query("SELECT id FROM users WHERE username = 'deleteme'"))[0].id;

  const delOk = await ownerAgent.post(`/admin/users/${userId}?_method=DELETE`);
  assert.equal(delOk.status, 302);
  const gone = await ctx.db.query("SELECT id FROM users WHERE id = ?", [userId]);
  assert.equal(gone.length, 0);

  const masterId = ctx.users.master.id;
  await ctx.db.query(`INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('Pay','+7','79990003344')`);
  const clientId = (await ctx.db.query("SELECT id FROM clients LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO cars(client_id, make) VALUES (?, 'VW')`, [clientId]);
  const carId = (await ctx.db.query("SELECT id FROM cars LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO orders(car_id, status) VALUES (?, 'in_progress')`, [carId]);
  const orderId = (await ctx.db.query("SELECT id FROM orders LIMIT 1"))[0].id;
  await ctx.db.query(
    `INSERT INTO order_lines(order_id, line_type, name, quantity, unit_price, total) VALUES (?, 'work', 'Работа', 1, 100, 100)`,
    [orderId]
  );
  const lineId = (await ctx.db.query("SELECT id FROM order_lines LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO order_line_payroll(order_line_id, user_id, share_percent) VALUES (?, ?, 100)`, [
    lineId,
    masterId
  ]);

  const blocked = await ownerAgent.post(`/admin/users/${masterId}?_method=DELETE`);
  assert.equal(blocked.status, 409);
  assert.match(blocked.text, /отключите вместо удаления/);
});

test("cannot delete self", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const ownerAgent = request.agent(ctx.app);
  await ctx.loginAs(ownerAgent, "owner", "owner");

  const res = await ownerAgent.post(`/admin/users/${ctx.users.owner.id}?_method=DELETE`);
  assert.equal(res.status, 400);
});
