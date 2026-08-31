const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { resetDB, getDB } = require("../../config/database");
const { applyMigrations } = require("../../config/migrations");
const { seedDefaultPermissions, clearPermissionCache } = require("../../config/permissions");
const { ensureDefaultSettings } = require("../../lib/settings");
const { hashPassword } = require("../../lib/password");

let cachedApp;
let cachedNodeEnv;

function getApp() {
  const nodeEnv = process.env.NODE_ENV;
  if (!cachedApp || cachedNodeEnv !== nodeEnv) {
    delete require.cache[require.resolve("../../server")];
    cachedApp = require("../../server").app;
    cachedNodeEnv = nodeEnv;
  }
  return cachedApp;
}

async function createTestApp() {
  const dbPath = path.join(os.tmpdir(), `autoservice-test-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite3`);
  process.env.SQLITE_PATH = dbPath;
  delete process.env.DATABASE_URL;
  process.env.DISABLE_CSRF = "1";
  process.env.DISABLE_LOGIN_RATE_LIMIT = "1";
  resetDB();
  clearPermissionCache();

  const app = getApp();
  const db = await getDB();
  await applyMigrations(db);
  await seedDefaultPermissions(db);
  await ensureDefaultSettings(db);

  async function insertUser(username, password, role, name) {
    const password_hash = hashPassword(password);
    const show_in_schedule = role === "master" || username === "vitalik" ? 1 : 0;
    await db.query(
      `INSERT INTO users(username, password_hash, name, role, is_active, show_in_schedule) VALUES (?, ?, ?, ?, 1, ?)`,
      [username, password_hash, name || username, role, show_in_schedule]
    );
    const rows = await db.query("SELECT id, username, role FROM users WHERE username = ?", [username]);
    return rows[0];
  }

  const owner = await insertUser("owner", "owner", "owner", "Owner");
  const admin = await insertUser("admin", "admin", "admin", "Admin");
  const manager = await insertUser("manager", "manager", "manager", "Manager");
  const master = await insertUser("master", "master", "master", "Master");

  async function loginAs(agent, username, password) {
    const res = await agent.post("/login").type("form").send({ username, password });
    return res;
  }

  return {
    app,
    db,
    dbPath,
    users: { owner, admin, manager, master },
    loginAs,
    async close() {
      await db.close();
      resetDB();
      clearPermissionCache();
      try {
        fs.unlinkSync(dbPath);
      } catch {
        // ignore
      }
    }
  };
}

module.exports = { createTestApp };
