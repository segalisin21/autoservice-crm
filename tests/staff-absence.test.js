const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { createTestApp } = require("./helpers/testApp");
const {
  orderOverlapsAbsence,
  isHourAbsent,
  canManageAbsenceForUser,
  insertAbsence
} = require("../lib/staffAbsence");
const { getMonthCalendar, assignOrdersToTimeSlots } = require("../lib/calendarData");

function absenceRow(userId, opts = {}) {
  return {
    user_id: userId,
    is_full_day: opts.is_full_day ? 1 : 0,
    start_time: opts.start_time ?? null,
    end_time: opts.end_time ?? null
  };
}

async function seedCar(ctx) {
  await ctx.db.query(
    `INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES ('Abs Client', '+7', '79990001122')`
  );
  const clientId = (await ctx.db.query("SELECT id FROM clients LIMIT 1"))[0].id;
  await ctx.db.query(`INSERT INTO cars(client_id, make) VALUES (?, 'Test')`, [clientId]);
  return (await ctx.db.query("SELECT id FROM cars LIMIT 1"))[0].id;
}

test("orderOverlapsAbsence: full day blocks any timed order", () => {
  const absences = [absenceRow(5, { is_full_day: true })];
  assert.equal(orderOverlapsAbsence(absences, 5, "11:00", "12:00"), true);
  assert.equal(orderOverlapsAbsence(absences, 5, null, null), true);
  assert.equal(orderOverlapsAbsence(absences, 6, "11:00", "12:00"), false);
});

test("orderOverlapsAbsence: partial 10-16 overlaps inside, not outside", () => {
  const absences = [absenceRow(5, { start_time: "10:00", end_time: "16:00" })];
  assert.equal(orderOverlapsAbsence(absences, 5, "12:00", "13:00"), true);
  assert.equal(orderOverlapsAbsence(absences, 5, "16:00", "17:00"), false);
  assert.equal(orderOverlapsAbsence(absences, 5, "09:00", "10:00"), false);
});

test("isHourAbsent marks hours inside partial absence", () => {
  const absences = [absenceRow(3, { start_time: "10:00", end_time: "16:00" })];
  assert.equal(isHourAbsent(absences, 3, 10), true);
  assert.equal(isHourAbsent(absences, 3, 15), true);
  assert.equal(isHourAbsent(absences, 3, 16), false);
});

test("canManageAbsenceForUser: master only self", () => {
  const master = { id: 2, role: "master" };
  const admin = { id: 1, role: "admin" };
  assert.equal(canManageAbsenceForUser(master, 2), true);
  assert.equal(canManageAbsenceForUser(master, 3), false);
  assert.equal(canManageAbsenceForUser(admin, 3), true);
});

test("master can create absence only for self", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "master", "master");

  const day = "2026-07-01";
  const ok = await agent.post("/schedule/absences").type("form").send({
    absence_date: day,
    user_id: String(ctx.users.master.id),
    is_full_day: "1"
  });
  assert.equal(ok.status, 302);

  const forbidden = await agent.post("/schedule/absences").type("form").send({
    absence_date: day,
    user_id: String(ctx.users.admin.id),
    is_full_day: "1"
  });
  assert.equal(forbidden.status, 403);
});

test("create order blocked when master is absent", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const carId = await seedCar(ctx);
  const masterId = ctx.users.master.id;
  const day = "2026-07-10";

  await insertAbsence(ctx.db, {
    user_id: masterId,
    absence_date: day,
    is_full_day: true,
    created_by: ctx.users.admin.id
  });

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");

  const res = await agent.post("/orders").type("form").send({
    car_id: String(carId),
    work_type: "Электрика",
    scheduled_date: day,
    assigned_user_id: String(masterId),
    start_time: "11:00",
    end_time: "12:00"
  });
  assert.equal(res.status, 400);
  assert.match(res.text, /отсутствует/i);
});

test("getMonthCalendar sets has_absence on days with absences", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const day = "2026-08-05";
  await insertAbsence(ctx.db, {
    user_id: ctx.users.master.id,
    absence_date: day,
    is_full_day: true,
    created_by: ctx.users.admin.id
  });

  const month = await getMonthCalendar(2026, 7);
  const meta = month.days.find((d) => d.date === day);
  assert.ok(meta);
  assert.equal(meta.has_absence, true);
});

test("assignOrdersToTimeSlots marks absent hours", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const day = "2026-08-12";
  const masterId = ctx.users.master.id;
  await insertAbsence(ctx.db, {
    user_id: masterId,
    absence_date: day,
    is_full_day: false,
    start_time: "10:00",
    end_time: "13:00",
    created_by: ctx.users.admin.id
  });

  const dayData = {
    date: day,
    employees: [
      {
        id: masterId,
        name: "Master",
        orders: [],
        has_absence: true,
        absence_labels: ["10:00–13:00"]
      }
    ],
    unassigned: [],
    absences: [
      {
        user_id: masterId,
        is_full_day: 0,
        start_time: "10:00",
        end_time: "13:00",
        label: "10:00–13:00"
      }
    ]
  };

  const grid = assignOrdersToTimeSlots(dayData);
  const col = grid.columns.find((c) => c.id === masterId);
  assert.ok(col);
  assert.equal(col.absentByHour[10], true);
  assert.equal(col.absentByHour[11], true);
  assert.equal(col.absentByHour[14], false);
});
