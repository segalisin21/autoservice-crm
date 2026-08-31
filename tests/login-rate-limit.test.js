const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const request = require("supertest");

const { resetDB, getDB } = require("../config/database");
const { applyMigrations } = require("../config/migrations");
const { seedDefaultPermissions, clearPermissionCache } = require("../config/permissions");
const { ensureDefaultSettings } = require("../lib/settings");
const { hashPassword } = require("../lib/password");

async function createRateLimitTestApp() {
  const dbPath = path.join(os.tmpdir(), `autoservice-rate-${Date.now()}.sqlite3`);
  process.env.SQLITE_PATH = dbPath;
  delete process.env.DATABASE_URL;
  process.env.DISABLE_CSRF = "1";
  delete process.env.DISABLE_LOGIN_RATE_LIMIT;
  resetDB();
  clearPermissionCache();

  delete require.cache[require.resolve("../server")];
  const app = require("../server").app;
  const db = await getDB();
  await applyMigrations(db);
  await seedDefaultPermissions(db);
  await ensureDefaultSettings(db);

  const password_hash = hashPassword("admin");
  await db.query(
    `INSERT INTO users(username, password_hash, name, role, is_active, show_in_schedule) VALUES ('admin', ?, 'Admin', 'admin', 1, 0)`,
    [password_hash]
  );

  return {
    app,
    db,
    async close() {
      await db.close();
      resetDB();
      clearPermissionCache();
      process.env.DISABLE_LOGIN_RATE_LIMIT = "1";
      try {
        fs.unlinkSync(dbPath);
      } catch {
        // ignore
      }
    }
  };
}

test("login rate limit returns 429 after 5 failed attempts", async (t) => {
  const ctx = await createRateLimitTestApp();
  t.after(() => ctx.close());

  const agent = request.agent(ctx.app);
  for (let i = 0; i < 5; i++) {
    const res = await agent.post("/login").type("form").send({ username: "admin", password: "wrong" });
    assert.equal(res.status, 401);
  }

  const blocked = await agent.post("/login").type("form").send({ username: "admin", password: "wrong" });
  assert.equal(blocked.status, 429);
  assert.match(blocked.text, /Слишком много попыток/i);
});

test("successful login works when rate limit disabled", async (t) => {
  const { createTestApp } = require("./helpers/testApp");
  const ctx = await createTestApp();
  t.after(() => ctx.close());

  const agent = request.agent(ctx.app);
  const res = await ctx.loginAs(agent, "admin", "admin");
  assert.equal(res.status, 302);
  assert.equal(res.headers.location, "/");
});
