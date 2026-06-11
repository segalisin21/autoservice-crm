const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

test("seed-catalog imports price sheet when catalog is empty", async (t) => {
  const dbPath = path.join(os.tmpdir(), `seed-catalog-${Date.now()}.sqlite3`);
  t.after(() => {
    try {
      fs.unlinkSync(dbPath);
    } catch {
      // ignore
    }
  });

  process.env.SQLITE_PATH = dbPath;
  delete process.env.DATABASE_URL;
  delete process.env.SKIP_CATALOG_SEED;

  const out = execFileSync(process.execPath, [path.join(__dirname, "..", "scripts", "seed-catalog.js")], {
    encoding: "utf8",
    env: { ...process.env, SQLITE_PATH: dbPath }
  });
  const first = JSON.parse(out.trim().split("\n").pop());
  assert.equal(first.seeded, true);
  assert.ok(first.catalogItems > 0);

  const out2 = execFileSync(process.execPath, [path.join(__dirname, "..", "scripts", "seed-catalog.js")], {
    encoding: "utf8",
    env: { ...process.env, SQLITE_PATH: dbPath }
  });
  const second = JSON.parse(out2.trim().split("\n").pop());
  assert.equal(second.skipped, true);
  assert.equal(second.reason, "catalog already has items");
});
