const fs = require("node:fs");
const path = require("node:path");

const { sqlNow } = require("./sqlDialect");

const MIGRATIONS_DIR = path.join(__dirname, "..", "migrations");

function migrationsDirFor(dialect) {
  if (dialect === "postgres") return path.join(MIGRATIONS_DIR, "postgres");
  return MIGRATIONS_DIR;
}

async function ensureMigrationsTable(db) {
  const now = sqlNow(db.dialect || "sqlite");
  await db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (${now})
    );
  `);
}

async function listApplied(db) {
  await ensureMigrationsTable(db);
  const rows = await db.query("SELECT id FROM migrations");
  return new Set(rows.map((r) => r.id));
}

function listMigrationFiles(dialect) {
  const dir = migrationsDirFor(dialect);
  if (!fs.existsSync(dir)) return [];
  const files = fs
    .readdirSync(dir)
    .filter((f) => /^\d+_.+\.sql$/i.test(f))
    .sort();
  return files.map((f) => ({ id: f, path: path.join(dir, f) }));
}

async function applyMigrations(db) {
  const dialect = db.dialect || "sqlite";
  const applied = await listApplied(db);
  const migrations = listMigrationFiles(dialect);

  for (const m of migrations) {
    if (applied.has(m.id)) continue;
    const sql = fs.readFileSync(m.path, "utf8");
    await db.exec(sql);
    await db.query("INSERT INTO migrations(id) VALUES (?)", [m.id]);
  }
}

module.exports = { applyMigrations };
