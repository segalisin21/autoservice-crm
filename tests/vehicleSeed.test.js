const test = require("node:test");
const assert = require("node:assert/strict");

const { syncFromSeed } = require("../lib/autoruCatalog");

test("syncFromSeed loads bundled catalog", async (t) => {
  const { getDB, resetDB } = require("../config/database");
  const { applyMigrations } = require("../config/migrations");

  process.env.SQLITE_PATH = ":memory:";
  resetDB();
  const db = await getDB();
  await applyMigrations(db);

  const stats = await syncFromSeed(db);
  assert.ok(stats.marks > 100, `expected many marks, got ${stats.marks}`);
  assert.ok(stats.models > 500, `expected many models, got ${stats.models}`);

  const toyota = await db.query("SELECT id FROM vehicle_marks WHERE autoru_id = 'toyota' LIMIT 1");
  assert.ok(toyota[0], "toyota mark should exist in seed");

  await db.close();
});
