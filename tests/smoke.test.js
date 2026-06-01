const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { createTestApp } = require("./helpers/testApp");

test("GET /login returns 200", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const res = await request(ctx.app).get("/login");
  assert.equal(res.status, 200);
  assert.match(res.text, /<title>Вход<\/title>/);
});

test("GET / without session redirects to /login", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const res = await request(ctx.app).get("/");
  assert.equal(res.status, 302);
  assert.equal(res.headers.location, "/login");
});

test("POST /login with owner redirects to /", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const agent = request.agent(ctx.app);
  const res = await ctx.loginAs(agent, "owner", "owner");
  assert.equal(res.status, 302);
  assert.equal(res.headers.location, "/");

  const dash = await agent.get("/");
  assert.equal(dash.status, 200);
  assert.match(dash.text, /calendar-grid/);
});
