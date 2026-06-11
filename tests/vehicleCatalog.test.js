const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { createTestApp } = require("./helpers/testApp");

async function seedVehicleCatalog(db) {
  await db.query(
    "INSERT INTO vehicle_marks(autoru_id, name, name_ru) VALUES ('toyota', 'Toyota', 'Тойота')"
  );
  const mark = await db.query("SELECT id FROM vehicle_marks WHERE autoru_id = 'toyota'");
  await db.query(
    "INSERT INTO vehicle_models(mark_id, autoru_id, name, name_ru, year_from, year_to) VALUES (?, 'camry', 'Camry', 'Камри', 2012, 2024)",
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
  assert.equal(res.body.items[0].display_name, "Toyota");
});

test("vehicle marks API uses cyrillic when configured", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());
  await seedVehicleCatalog(ctx.db);
  await ctx.db.query(
    `INSERT INTO settings(key, value) VALUES ('vehicle_catalog_names', 'cyrillic') ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  );

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");

  const res = await agent.get("/api/vehicles/marks?q=toy");
  assert.equal(res.status, 200);
  assert.equal(res.body.items.length, 1);
  assert.equal(res.body.items[0].display_name, "Тойота");
  assert.equal(res.body.name_mode, "cyrillic");
});

test("vehicle marks API is case-insensitive", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());
  await seedVehicleCatalog(ctx.db);

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");

  const res = await agent.get("/api/vehicles/marks?q=TOY");
  assert.equal(res.status, 200);
  assert.equal(res.body.items.length, 1);
  assert.equal(res.body.items[0].display_name, "Toyota");
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
  assert.equal(res.body.items[0].display_name, "Camry");
});

test("vehicle models API is case-insensitive", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());
  await seedVehicleCatalog(ctx.db);
  const mark = await ctx.db.query("SELECT id FROM vehicle_marks WHERE autoru_id = 'toyota'");

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");

  const res = await agent.get(`/api/vehicles/models?mark_id=${mark[0].id}&q=CAM`);
  assert.equal(res.status, 200);
  assert.equal(res.body.items[0].display_name, "Camry");
});

test("vehicle models API searches globally without mark", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());
  await seedVehicleCatalog(ctx.db);

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");

  const res = await agent.get("/api/vehicles/models?q=camry");
  assert.equal(res.status, 200);
  assert.equal(res.body.items.length, 1);
  assert.equal(res.body.items[0].display_name, "Camry");
  assert.equal(res.body.items[0].mark_display_name, "Toyota");
});

test("vehicle API requires auth", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const res = await request(ctx.app).get("/api/vehicles/marks");
  assert.equal(res.status, 302);
});
