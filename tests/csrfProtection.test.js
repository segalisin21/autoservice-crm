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

async function createCsrfTestApp() {
  const dbPath = path.join(os.tmpdir(), `autoservice-csrf-${Date.now()}.sqlite3`);
  process.env.SQLITE_PATH = dbPath;
  delete process.env.DATABASE_URL;
  delete process.env.DISABLE_CSRF;
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
      process.env.DISABLE_CSRF = "1";
      try {
        fs.unlinkSync(dbPath);
      } catch {
        // ignore
      }
    }
  };
}

function extractCsrfToken(html) {
  const meta = html.match(/name="csrf-token"\s+content="([^"]+)"/);
  return meta ? meta[1] : null;
}

test("POST without CSRF token is rejected", async (t) => {
  const ctx = await createCsrfTestApp();
  t.after(() => ctx.close());

  const agent = request.agent(ctx.app);
  await agent.post("/login").type("form").send({ username: "admin", password: "admin" });

  const res = await agent.post("/expenses").type("form").send({ amount: "100", category: "other" });
  assert.equal(res.status, 403);
  assert.match(res.text, /CSRF/i);
});

test("POST with CSRF token succeeds", async (t) => {
  const ctx = await createCsrfTestApp();
  t.after(() => ctx.close());

  const agent = request.agent(ctx.app);
  await agent.post("/login").type("form").send({ username: "admin", password: "admin" });

  const page = await agent.get("/expenses");
  const token = extractCsrfToken(page.text);
  assert.ok(token);

  const res = await agent
    .post("/expenses")
    .type("form")
    .send({ _csrf: token, amount: "500", category: "other", expense_date: "2026-06-01", note: "test" });
  assert.equal(res.status, 302);
});
