const { getDB } = require("../config/database");
const { applyMigrations } = require("../config/migrations");

async function main() {
  const db = await getDB();
  await applyMigrations(db);
  await db.close();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});

