const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { createTestApp } = require("./helpers/testApp");

test("admin can create client and car with normalized fields", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");

  const createClient = await agent
    .post("/clients")
    .type("form")
    .send({ full_name: "Иван Иванов", phone: "8 (999) 111-22-33", email: "", notes: "" });
  assert.equal(createClient.status, 302);

  const rows = await ctx.db.query("SELECT phone_normalized FROM clients WHERE full_name = ?", [
    "Иван Иванов"
  ]);
  assert.equal(rows[0].phone_normalized, "79991112233");

  const clientId = (await ctx.db.query("SELECT id FROM clients WHERE full_name = ?", ["Иван Иванов"]))[0]
    .id;

  const createCar = await agent.post("/cars").type("form").send({
    client_id: String(clientId),
    make: "Toyota",
    model: "Camry",
    license_plate_raw: "а 123 вс 77",
    vin: "",
    year: "",
    color: "",
    mileage: "",
    notes: ""
  });
  assert.equal(createCar.status, 302);

  const cars = await ctx.db.query(
    "SELECT license_plate_normalized FROM cars WHERE client_id = ?",
    [clientId]
  );
  assert.equal(cars[0].license_plate_normalized, "А123ВС77");
});

test("master cannot access clients mutate", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "master", "master");

  const res = await agent.get("/clients/new");
  assert.equal(res.status, 403);
});

test("admin can open client show page", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");

  const createClient = await agent
    .post("/clients")
    .type("form")
    .send({ full_name: "Петр Петров", phone: "8 (999) 222-33-44", email: "", notes: "" });
  assert.equal(createClient.status, 302);

  const clientId = (
    await ctx.db.query("SELECT id FROM clients WHERE full_name = ?", ["Петр Петров"])
  )[0].id;

  const res = await agent.get(`/clients/${clientId}`);
  assert.equal(res.status, 200);
  assert.ok(res.text.includes("Петр Петров"));
  assert.ok(!res.text.includes("include is not a function"));
});

test("master can view clients list if permission added later - default denied", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "master", "master");

  const res = await agent.get("/clients");
  assert.equal(res.status, 403);
});
