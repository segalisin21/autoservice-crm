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

test("POST /login persists session behind HTTPS proxy in production", async (t) => {
  const prevEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  const ctx = await createTestApp();
  t.after(async () => {
    process.env.NODE_ENV = prevEnv;
    await ctx.close();
  });

  const res = await request(ctx.app)
    .post("/login")
    .set("X-Forwarded-Proto", "https")
    .type("form")
    .send({ username: "owner", password: "owner" });
  assert.equal(res.status, 302);
  assert.equal(res.headers.location, "/");
  const cookies = res.headers["set-cookie"];
  assert.ok(Array.isArray(cookies) && cookies.length > 0);
  assert.match(cookies.join(";"), /Secure/i);

  const dash = await request(ctx.app)
    .get("/")
    .set("Cookie", cookies.map((c) => c.split(";")[0]).join("; "))
    .set("X-Forwarded-Proto", "https");
  assert.equal(dash.status, 200);
  assert.match(dash.text, /calendar-grid/);
});
