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
  assert.doesNotMatch(res.text, />\s*Manager\s*</);
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
  assert.equal(col.maxLanes, 1);
  const lane0 = col.lanes[0];
  assert.equal(lane0.byHour[14].length, 1);
  assert.equal(lane0.byHour[14][0].start_time, "14:30");
  assert.equal(lane0.byHour[10].length, 0);

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");
  const html = await agent.get(`/?mode=day&date=${day}`);
  assert.equal(html.status, 200);
  assert.match(html.text, /schedule-time-grid/);
  assert.match(html.text, /data-hour="14"/);
});

test("multi-hour order spans three rows for 10:00–13:00", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const masterId = ctx.users.master.id;
  await ctx.db.query(`INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('Span', '+7', '79991114455')`);
  const clientId = (await ctx.db.query("SELECT id FROM clients LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO cars(client_id, make) VALUES (?, 'VW')`, [clientId]);
  const carId = (await ctx.db.query("SELECT id FROM cars LIMIT 1"))[0].id;

  const day = "2026-06-16";
  await ctx.db.query(
    `INSERT INTO orders(car_id, status, scheduled_date, assigned_user_id, start_time, end_time, total_price) VALUES (?, 'scheduled', ?, ?, '10:00', '13:00', 1500)`,
    [carId, day, masterId]
  );

  const dayData = await getDayByEmployees(day);
  const grid = assignOrdersToTimeSlots(dayData);
  const col = grid.columns.find((c) => c.id === masterId);
  assert.ok(col);
  assert.equal(col.maxLanes, 1);
  const lane0 = col.lanes[0];
  assert.equal(lane0.byHour[10].length, 1);
  assert.equal(lane0.byHour[10][0].span_rows, 3);
  assert.equal(lane0.byHour[10][0].end_time, "13:00");
  assert.equal(lane0.coveredBySpan[11], true);
  assert.equal(lane0.coveredBySpan[12], true);
  assert.equal(lane0.coveredBySpan[13], false);

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");
  const html = await agent.get(`/?mode=day&date=${day}`);
  assert.equal(html.status, 200);
  assert.match(html.text, /rowspan="3"/);
  assert.match(html.text, /10:00–13:00/);
});

test("garage day view shows time range for multi-hour order", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const masterId = ctx.users.master.id;
  await ctx.db.query(`INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('GarageSpan', '+7', '79991115566')`);
  const clientId = (await ctx.db.query("SELECT id FROM clients LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO cars(client_id, make) VALUES (?, 'Ford')`, [clientId]);
  const carId = (await ctx.db.query("SELECT id FROM cars LIMIT 1"))[0].id;

  const day = "2026-06-17";
  await ctx.db.query(
    `INSERT INTO orders(car_id, status, scheduled_date, assigned_user_id, start_time, end_time, total_price) VALUES (?, 'scheduled', ?, ?, '10:00', '13:00', 2000)`,
    [carId, day, masterId]
  );

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");
  const html = await agent.get(`/?mode=day&date=${day}`);
  assert.equal(html.status, 200);
  assert.match(html.text, /10:00–13:00/);
});

test("multi-day order shows end date badge on start day only", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const masterId = ctx.users.master.id;
  await ctx.db.query(`INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('MultiDay', '+7', '79991116677')`);
  const clientId = (await ctx.db.query("SELECT id FROM clients LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO cars(client_id, make) VALUES (?, 'UAZ')`, [clientId]);
  const carId = (await ctx.db.query("SELECT id FROM cars LIMIT 1"))[0].id;

  await ctx.db.query(
    `INSERT INTO orders(car_id, status, scheduled_date, scheduled_end_date, assigned_user_id, start_time, end_time, total_price) VALUES (?, 'scheduled', '2026-06-17', '2026-06-20', ?, '10:00', '13:00', 3000)`,
    [carId, masterId]
  );

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");

  const startDay = await agent.get("/?mode=day&date=2026-06-17");
  assert.equal(startDay.status, 200);
  assert.match(startDay.text, /до 20\.06/);

  const midDay = await agent.get("/?mode=day&date=2026-06-18");
  assert.equal(midDay.status, 200);
  assert.doesNotMatch(midDay.text, /до 20\.06/);
});

test("overlapping orders at 10:00 use separate lanes with independent rowspan", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const masterId = ctx.users.master.id;
  await ctx.db.query(`INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('Overlap', '+7', '79991117788')`);
  const clientId = (await ctx.db.query("SELECT id FROM clients LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO cars(client_id, make) VALUES (?, 'Jaguar')`, [clientId]);
  const carId = (await ctx.db.query("SELECT id FROM cars LIMIT 1"))[0].id;

  const day = "2026-06-19";
  await ctx.db.query(
    `INSERT INTO orders(car_id, status, scheduled_date, assigned_user_id, start_time, total_price) VALUES (?, 'scheduled', ?, ?, '10:00', 800)`,
    [carId, day, masterId]
  );
  await ctx.db.query(
    `INSERT INTO orders(car_id, status, scheduled_date, assigned_user_id, start_time, end_time, total_price) VALUES (?, 'scheduled', ?, ?, '10:00', '13:00', 1200)`,
    [carId, day, masterId]
  );

  const dayData = await getDayByEmployees(day);
  const grid = assignOrdersToTimeSlots(dayData);
  const col = grid.columns.find((c) => c.id === masterId);
  assert.ok(col);
  assert.equal(col.maxLanes, 2);

  const longLane = col.lanes.find((lane) => lane.byHour[10].some((o) => o.span_rows === 3));
  const shortLane = col.lanes.find((lane) => lane.byHour[10].some((o) => (o.span_rows || 1) === 1));
  assert.ok(longLane, "long order in its own lane");
  assert.ok(shortLane, "short order in its own lane");
  assert.notEqual(longLane, shortLane);
  assert.equal(longLane.coveredBySpan[11], true);
  assert.equal(longLane.coveredBySpan[12], true);

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");
  const html = await agent.get(`/?mode=day&date=${day}`);
  assert.equal(html.status, 200);
  assert.match(html.text, /data-lane="0"/);
  assert.match(html.text, /data-lane="1"/);
  assert.match(html.text, /schedule-lane-col--split/);
  assert.match(html.text, new RegExp(`data-employee="${masterId}"[^>]*data-lane="0"[^>]*rowspan="3"`));
});
