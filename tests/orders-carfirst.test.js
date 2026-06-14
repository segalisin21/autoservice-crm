const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { createTestApp } = require("./helpers/testApp");
const { minimalOrderPayload } = require("./helpers/orderCreate");

test("creating order with new car + owner creates client, car, order", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");

  const res = await agent.post("/orders").type("form").send(
    minimalOrderPayload(ctx, {
      work_type: "Электрика",
      car_id: "",
      new_plate: "О777ОО199",
      new_make: "Lada",
      new_model: "Vesta",
      new_year: "2021",
      new_owner_name: "Иванов Иван",
      new_owner_phone: "+7 999 123-45-67"
    })
  );
  assert.equal(res.status, 302);

  const client = (await ctx.db.query("SELECT * FROM clients WHERE full_name = 'Иванов Иван'"))[0];
  assert.ok(client);
  const car = (await ctx.db.query("SELECT * FROM cars WHERE client_id = ?", [client.id]))[0];
  assert.ok(car);
  assert.equal(car.make, "Lada");
  assert.equal(car.license_plate_normalized, "О777ОО199");
  const order = (await ctx.db.query("SELECT * FROM orders WHERE car_id = ?", [car.id]))[0];
  assert.ok(order);
});

test("creating order with plate only creates stub client", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");

  const res = await agent.post("/orders").type("form").send(
    minimalOrderPayload(ctx, {
      car_id: "",
      new_plate: "К999КК177"
    })
  );
  assert.equal(res.status, 302);

  const client = (await ctx.db.query("SELECT * FROM clients WHERE full_name = 'Уточнить при приёмке'"))[0];
  assert.ok(client);
  const car = (await ctx.db.query("SELECT * FROM cars WHERE license_plate_normalized = 'К999КК177'"))[0];
  assert.ok(car);
});

test("order form finds car by plate", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(`INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('Петров','+7','79990001122')`);
  const clientId = (await ctx.db.query("SELECT id FROM clients LIMIT 1"))[0].id;
  await ctx.db.query(
    `INSERT INTO cars(client_id, make, license_plate_raw, license_plate_normalized) VALUES (?, 'Kia', 'В123ВВ77', 'В123ВВ77')`,
    [clientId]
  );

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");
  const res = await agent.get("/orders/new?plate=В123ВВ77");
  assert.equal(res.status, 200);
  assert.match(res.text, /Петров/);
});

test("new order without car shows error", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");
  const res = await agent.post("/orders").type("form").send(
    minimalOrderPayload(ctx, {
      car_id: ""
    })
  );
  assert.equal(res.status, 400);
  assert.match(res.text, /госномер/i);
});

test("new order requires date, start time, and employee", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(`INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('Req','+7','79990005566')`);
  const clientId = (await ctx.db.query("SELECT id FROM clients LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO cars(client_id, make) VALUES (?, 'Audi')`, [clientId]);
  const carId = (await ctx.db.query("SELECT id FROM cars LIMIT 1"))[0].id;

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");

  const noDate = await agent.post("/orders").type("form").send({
    car_id: String(carId),
    start_time: "10:00",
    assigned_user_id: String(ctx.users.master.id)
  });
  assert.equal(noDate.status, 400);
  assert.match(noDate.text, /дату/i);

  const noTime = await agent.post("/orders").type("form").send({
    car_id: String(carId),
    scheduled_date: "2026-05-27",
    assigned_user_id: String(ctx.users.master.id)
  });
  assert.equal(noTime.status, 400);
  assert.match(noTime.text, /время/i);

  const noEmployee = await agent.post("/orders").type("form").send({
    car_id: String(carId),
    scheduled_date: "2026-05-27",
    start_time: "10:00"
  });
  assert.equal(noEmployee.status, 400);
  assert.match(noEmployee.text, /сотрудник/i);
});

test("order saves multiple work types from hidden field", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(`INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('Multi','+7','79990003344')`);
  const clientId = (await ctx.db.query("SELECT id FROM clients LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO cars(client_id, make) VALUES (?, 'VW')`, [clientId]);
  const carId = (await ctx.db.query("SELECT id FROM cars LIMIT 1"))[0].id;

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");

  const res = await agent.post("/orders").type("form").send(
    minimalOrderPayload(ctx, {
      work_type: "Мойка, Электрика",
      car_id: String(carId)
    })
  );
  assert.equal(res.status, 302);

  const order = (await ctx.db.query("SELECT work_type FROM orders WHERE car_id = ?", [carId]))[0];
  assert.equal(order.work_type, "Мойка, Электрика");
});

test("create order without work types is allowed", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(`INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('NoType','+7','79990004455')`);
  const clientId = (await ctx.db.query("SELECT id FROM clients LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO cars(client_id, make) VALUES (?, 'BMW')`, [clientId]);
  const carId = (await ctx.db.query("SELECT id FROM cars LIMIT 1"))[0].id;

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");

  const res = await agent.post("/orders").type("form").send(
    minimalOrderPayload(ctx, {
      work_type: "",
      car_id: String(carId)
    })
  );
  assert.equal(res.status, 302);

  const order = (await ctx.db.query("SELECT work_type FROM orders WHERE car_id = ?", [carId]))[0];
  assert.equal(order.work_type, null);
});

test("update order without work types returns validation error", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(`INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('UpdType','+7','79990006677')`);
  const clientId = (await ctx.db.query("SELECT id FROM clients LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO cars(client_id, make) VALUES (?, 'BMW')`, [clientId]);
  const carId = (await ctx.db.query("SELECT id FROM cars LIMIT 1"))[0].id;

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");

  await agent.post("/orders").type("form").send(
    minimalOrderPayload(ctx, {
      work_type: "Электрика",
      car_id: String(carId)
    })
  );
  const orderId = (await ctx.db.query("SELECT id FROM orders ORDER BY id DESC LIMIT 1"))[0].id;

  const res = await agent.put(`/orders/${orderId}`).type("form").send({
    work_type: "",
    scheduled_date: "2026-05-27",
    notes: ""
  });
  assert.equal(res.status, 302);
  assert.match(res.headers.location, /work_type_error=1/);
});
