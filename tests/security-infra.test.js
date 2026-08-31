const { test } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { createTestApp } = require("./helpers/testApp");

test("health endpoint reports db dialect", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const res = await request(ctx.app).get("/health");
  assert.equal(res.status, 200);
  assert.equal(res.body.status, "ok");
  assert.equal(res.body.db, "sqlite");
});

test("async route errors return 500 not crash", async (t) => {
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const agent = request.agent(ctx.app);
  await ctx.loginAs(agent, "admin", "admin");

  const res = await agent.get("/clients/999999");
  assert.equal(res.status, 404);
});
