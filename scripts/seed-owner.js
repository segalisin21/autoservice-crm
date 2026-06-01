const { getDB } = require("../config/database");
const { applyMigrations } = require("../config/migrations");
const { seedDefaultPermissions } = require("../config/permissions");
const { hashPassword } = require("../lib/password");

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

async function main() {
  const username = getArg("--username") || process.env.OWNER_USERNAME;
  const password = getArg("--password") || process.env.OWNER_PASSWORD;
  const name = getArg("--name") || process.env.OWNER_NAME || "Owner";

  if (!username || !password) {
    // Non-fatal: allows chaining in a prod start command without blocking boot.
    // eslint-disable-next-line no-console
    console.warn(
      "seed-owner: no credentials (use --username/--password or OWNER_USERNAME/OWNER_PASSWORD), skipping"
    );
    return;
  }

  const db = await getDB();
  await applyMigrations(db);
  await seedDefaultPermissions(db);

  const passwordHash = hashPassword(password);
  await db.query(
    `
    INSERT INTO users(username, password_hash, name, role, is_active)
    VALUES (?, ?, ?, 'owner', 1)
    ON CONFLICT(username) DO UPDATE SET
      password_hash=excluded.password_hash,
      name=excluded.name,
      role='owner',
      is_active=1,
      updated_at=(datetime('now'))
  `,
    [username, passwordHash, name]
  );

  await db.close();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err.message || err);
  process.exitCode = 1;
});

