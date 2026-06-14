const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { resetDB, getDB } = require("../../config/database");
const { applyMigrations } = require("../../config/migrations");
const { seedDefaultPermissions, clearPermissionCache } = require("../../config/permissions");
const { ensureDefaultSettings } = require("../../lib/settings");
const { hashPassword } = require("../../lib/password");

async function createTestApp() {
  const dbPath = path.join(os.tmpdir(), `autoservice-test-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite3`);
  process.env.SQLITE_PATH = dbPath;
  resetDB();
  clearPermissionCache();

  delete require.cache[require.resolve("../../server")];
  const { app } = require("../../server");

  const db = await getDB();
  await applyMigrations(db);
  await seedDefaultPermissions(db);
  await ensureDefaultSettings(db);

  async function insertUser(username, password, role, name) {
    const password_hash = hashPassword(password);
    await db.query(
      `INSERT INTO users(username, password_hash, name, role, is_active) VALUES (?, ?, ?, ?, 1)`,
      [username, password_hash, name || username, role]
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
