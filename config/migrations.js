const fs = require("node:fs");
const path = require("node:path");

const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");

async function ensureMigrationsTable(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

async function listApplied(db) {
  await ensureMigrationsTable(db);
  const rows = await db.query("SELECT id FROM migrations");
  return new Set(rows.map((r) => r.id));
}

function listMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d+_.+\.sql$/i.test(f))
    .sort();
  return files.map((f) => ({ id: f, path: path.join(MIGRATIONS_DIR, f) }));
}

async function applyMigrations(db) {
  const applied = await listApplied(db);
  const migrations = listMigrationFiles();

  for (const m of migrations) {
    if (applied.has(m.id)) continue;
    const sql = fs.readFileSync(m.path, "utf8");
    await db.exec(sql);
    await db.query("INSERT INTO migrations(id) VALUES (?)", [m.id]);
  }
}

module.exports = { applyMigrations };

