const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { createTestApp } = require("./helpers/testApp");
const { getDayByEmployees, getMonthCalendar, assignOrdersToTimeSlots } = require("../lib/calendarData");

test("dashboard month view shows calendar", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");

  const res = await agent.get("/?mode=month");
  assert.equal(res.status, 200);
  assert.match(res.text, /calendar-grid/);
});

test("orders grouped by employee on selected day", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const masterId = ctx.users.master.id;
  await ctx.db.query(
    `INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('Cal', '+7', '79991112233')`
  );
  const clientId = (await ctx.db.query("SELECT id FROM clients LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO cars(client_id, make, license_plate_raw) VALUES (?, 'BMW', 'A111AA')`, [
    clientId
  ]);
  const carId = (await ctx.db.query("SELECT id FROM cars LIMIT 1"))[0].id;

  const day = "2026-05-27";
  await ctx.db.query(
    `INSERT INTO orders(car_id, status, scheduled_date, assigned_user_id, start_time, total_price) VALUES (?, 'scheduled', ?, ?, '10:00', 1000)`,
    [carId, day, masterId]
  );
  await ctx.db.query(
    `INSERT INTO orders(car_id, status, scheduled_date, assigned_user_id, total_price) VALUES (?, 'in_progress', ?, NULL, 500)`,
    [carId, day]
  );

  const data = await getDayByEmployees(day);
  const masterCol = data.employees.find((e) => e.id === masterId);
  assert.ok(masterCol, "master column exists");
  assert.equal(masterCol.orders.length, 1);
  assert.equal(masterCol.orders[0].start_time, "10:00");
  assert.equal(data.unassigned.length, 1);

  const month = await getMonthCalendar(2026, 4);
  const dayMeta = month.days.find((d) => d.date === day);
  assert.equal(dayMeta.booking_count, 2);
});

test("dashboard day view shows employee columns", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");

  const res = await agent.get("/?mode=day&date=2026-05-27");
  assert.equal(res.status, 200);
  assert.match(res.text, /garage-day-grid/);
  assert.match(res.text, /Master/);
});

test("order at 14:00 lands in correct time slot", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const masterId = ctx.users.master.id;
  await ctx.db.query(`INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('Slot', '+7', '79991113344')`);
  const clientId = (await ctx.db.query("SELECT id FROM clients LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO cars(client_id, make) VALUES (?, 'Audi')`, [clientId]);
  const carId = (await ctx.db.query("SELECT id FROM cars LIMIT 1"))[0].id;

  const day = "2026-06-15";
  await ctx.db.query(
    `INSERT INTO orders(car_id, status, scheduled_date, assigned_user_id, start_time, total_price) VALUES (?, 'scheduled', ?, ?, '14:30', 2000)`,
    [carId, day, masterId]
  );

  const dayData = await getDayByEmployees(day);
  const grid = assignOrdersToTimeSlots(dayData);
  const col = grid.columns.find((c) => c.id === masterId);
  assert.ok(col);
  assert.equal(col.byHour[14].length, 1);
  assert.equal(col.byHour[14][0].start_time, "14:30");
  assert.equal(col.byHour[10].length, 0);

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");
  const html = await agent.get(`/?mode=day&date=${day}`);
  assert.equal(html.status, 200);
  assert.match(html.text, /schedule-time-grid/);
  assert.match(html.text, /data-hour="14"/);
});
