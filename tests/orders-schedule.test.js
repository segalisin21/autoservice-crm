const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { createTestApp } = require("./helpers/testApp");
const { getDayByEmployees } = require("../lib/calendarData");

async function seedOrderOnDay(ctx, { day, masterId, startTime = "10:00" }) {
  await ctx.db.query(
    `INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('Sched', '+7', '79990001122')`
  );
  const clientId = (await ctx.db.query("SELECT id FROM clients ORDER BY id DESC LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO cars(client_id, make, license_plate_raw) VALUES (?, 'VW', 'S001AA')`, [
    clientId
  ]);
  const carId = (await ctx.db.query("SELECT id FROM cars ORDER BY id DESC LIMIT 1"))[0].id;
  await ctx.db.query(
    `INSERT INTO orders(car_id, status, scheduled_date, assigned_user_id, start_time, total_price) VALUES (?, 'scheduled', ?, ?, ?, 1000)`,
    [carId, day, masterId, startTime]
  );
  const orderId = (await ctx.db.query("SELECT id FROM orders ORDER BY id DESC LIMIT 1"))[0].id;
  return { carId, orderId };
}

test("manager is not shown in day schedule columns", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const day = "2026-06-20";
  const data = await getDayByEmployees(day);
  const ids = data.employees.map((e) => e.id);
  assert.ok(ids.includes(ctx.users.master.id));
  assert.equal(ids.includes(ctx.users.manager.id), false);
  assert.equal(ids.includes(ctx.users.admin.id), false);
});

test("schedule columns ordered by schedule_order", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(
    `INSERT INTO users(username, password_hash, name, role, is_active, schedule_order) VALUES ('mA', 'x', 'Alpha', 'master', 1, 20)`
  );
  await ctx.db.query(
    `INSERT INTO users(username, password_hash, name, role, is_active, schedule_order) VALUES ('mZ', 'x', 'Zulu', 'master', 1, 10)`
  );

  const data = await getDayByEmployees("2026-06-21");
  const names = data.employees.map((e) => e.name);
  const zIdx = names.indexOf("Zulu");
  const aIdx = names.indexOf("Alpha");
  assert.ok(zIdx >= 0 && aIdx >= 0);
  assert.ok(zIdx < aIdx, "lower schedule_order comes first");
});

test("POST /schedule/columns/reorder swaps master column order", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query("UPDATE users SET schedule_order = 10 WHERE id = ?", [ctx.users.master.id]);
  await ctx.db.query(
    `INSERT INTO users(username, password_hash, name, role, is_active, schedule_order) VALUES ('mB', 'x', 'Bravo', 'master', 1, 20)`
  );
  const secondId = (await ctx.db.query("SELECT id FROM users WHERE username = 'mB'"))[0].id;

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "manager", "manager");

  const day = "2026-06-22";
  const res = await agent
    .post("/schedule/columns/reorder")
    .type("form")
    .send({ user_id: String(secondId), direction: "left", date: day });
  assert.equal(res.status, 302);

  const rows = await ctx.db.query(
    "SELECT id, schedule_order FROM users WHERE id IN (?, ?) ORDER BY schedule_order",
    [ctx.users.master.id, secondId]
  );
  assert.equal(Number(rows[0].id), secondId);
  assert.equal(Number(rows[1].id), ctx.users.master.id);
});

test("PATCH /orders/:id/schedule changes master and work line master_id", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(
    `INSERT INTO users(username, password_hash, name, role, is_active, schedule_order) VALUES ('mOther', 'x', 'Other', 'master', 1, 30)`
  );
  const otherMasterId = (await ctx.db.query("SELECT id FROM users WHERE username = 'mOther'"))[0].id;

  const day = "2026-06-23";
  const { orderId } = await seedOrderOnDay(ctx, { day, masterId: ctx.users.master.id });

  await ctx.db.query(
    `INSERT INTO order_lines(order_id, line_type, name, quantity, unit_price, total, master_id) VALUES (?, 'work', 'Test work', 1, 1000, 1000, ?)`,
    [orderId, ctx.users.master.id]
  );

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "manager", "manager");

  const res = await agent
    .patch(`/orders/${orderId}/schedule`)
    .set("Accept", "application/json")
    .send({ assigned_user_id: otherMasterId, start_time: "11:00" });
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);

  const order = (await ctx.db.query("SELECT assigned_user_id, start_time FROM orders WHERE id = ?", [orderId]))[0];
  assert.equal(Number(order.assigned_user_id), otherMasterId);
  assert.equal(order.start_time, "11:00");

  const line = (await ctx.db.query("SELECT master_id FROM order_lines WHERE order_id = ?", [orderId]))[0];
  assert.equal(Number(line.master_id), otherMasterId);
});

test("PATCH /orders/:id/schedule forbidden for master role", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const day = "2026-06-24";
  const { orderId } = await seedOrderOnDay(ctx, { day, masterId: ctx.users.master.id });

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "master", "master");

  const res = await agent
    .patch(`/orders/${orderId}/schedule`)
    .set("Accept", "application/json")
    .send({ assigned_user_id: ctx.users.master.id });
  assert.equal(res.status, 403);
});

test("PATCH /orders/:id/schedule rejects absent master", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  await ctx.db.query(
    `INSERT INTO users(username, password_hash, name, role, is_active, schedule_order) VALUES ('mAway', 'x', 'Away', 'master', 1, 40)`
  );
  const awayId = (await ctx.db.query("SELECT id FROM users WHERE username = 'mAway'"))[0].id;

  const day = "2026-06-25";
  const { orderId } = await seedOrderOnDay(ctx, { day, masterId: ctx.users.master.id });

  await ctx.db.query(
    `INSERT INTO staff_absences(user_id, absence_date, is_full_day, created_by) VALUES (?, ?, 1, ?)`,
    [awayId, day, ctx.users.admin.id]
  );

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");

  const res = await agent
    .patch(`/orders/${orderId}/schedule`)
    .set("Accept", "application/json")
    .send({ assigned_user_id: awayId });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /отсутствует/i);
});
