const fs = require("node:fs");
const path = require("node:path");

const { getDB, resetDB } = require("../config/database");
const { applyMigrations } = require("../config/migrations");
const { syncAll } = require("../lib/autoruCatalog");

const OUT = path.join(__dirname, "..", "seeds", "vehicle-catalog-seed.json");
const MAX_MARKS = Number(process.env.SEED_MAX_MARKS || 120);

async function main() {
  process.env.SQLITE_PATH = path.join(__dirname, "..", "data", ".seed-export.sqlite3");
  resetDB();
  const db = await getDB();
  await applyMigrations(db);

  const stats = await syncAll(db, {
    maxMarks: MAX_MARKS,
    log: (msg) => console.log(msg)
  });

  const marks = await db.query("SELECT autoru_id, name, name_ru FROM vehicle_marks ORDER BY name_ru");
  const payload = { exported_at: new Date().toISOString(), stats, marks: [] };

  for (const mark of marks) {
    const models = await db.query(
      "SELECT autoru_id, name, name_ru, year_from, year_to FROM vehicle_models WHERE mark_id = (SELECT id FROM vehicle_marks WHERE autoru_id = ?)",
      [mark.autoru_id]
    );
    payload.marks.push({
      autoru_id: mark.autoru_id,
      name: mark.name,
      name_ru: mark.name_ru,
      models: models.map((m) => ({
        autoru_id: m.autoru_id,
        name: m.name,
        name_ru: m.name_ru,
        year_from: m.year_from,
        year_to: m.year_to
      }))
    });
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote ${payload.marks.length} marks to ${OUT}`);
  await db.close();
  try {
    fs.unlinkSync(process.env.SQLITE_PATH);
  } catch {
    /* ignore */
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
