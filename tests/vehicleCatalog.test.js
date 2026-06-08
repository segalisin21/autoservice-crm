const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { createTestApp } = require("./helpers/testApp");

async function seedVehicleCatalog(db) {
  await db.query(
    "INSERT INTO vehicle_marks(autoru_id, name, name_ru) VALUES ('toyota', 'toyota', 'Toyota')"
  );
  const mark = await db.query("SELECT id FROM vehicle_marks WHERE autoru_id = 'toyota'");
  await db.query(
    "INSERT INTO vehicle_models(mark_id, autoru_id, name, name_ru, year_from, year_to) VALUES (?, 'camry', 'camry', 'Camry', 2012, 2024)",
    [mark[0].id]
  );
}

test("vehicle marks API returns seeded marks", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());
  await seedVehicleCatalog(ctx.db);

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");

  const res = await agent.get("/api/vehicles/marks?q=toy");
  assert.equal(res.status, 200);
  assert.equal(res.body.items.length, 1);
  assert.equal(res.body.items[0].name_ru, "Toyota");
});

test("vehicle models API filters by mark", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());
  await seedVehicleCatalog(ctx.db);
  const mark = await ctx.db.query("SELECT id FROM vehicle_marks WHERE autoru_id = 'toyota'");

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");

  const res = await agent.get(`/api/vehicles/models?mark_id=${mark[0].id}&q=cam`);
  assert.equal(res.status, 200);
  assert.equal(res.body.items[0].name_ru, "Camry");
});

test("vehicle API requires auth", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const res = await request(ctx.app).get("/api/vehicles/marks");
  assert.equal(res.status, 302);
});
