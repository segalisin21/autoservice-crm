/**
 * Миграция схемы + базовые настройки + карточки каталога из прайса.
 *
 * Не импортирует старый учёт из «Учет - Лист1 (1).csv».
 *
 * Запуск:
 *   npm run setup:db
 *   npm run setup:db -- "Прайс от 12.2025 - Лист1.csv"
 *   npm run setup:db -- --dry-run
 *   npm run setup:db -- --skip-owner
 *
 * Переменные:
 *   DATABASE_URL / SQLITE_PATH — подключение к БД
 *   OWNER_USERNAME, OWNER_PASSWORD, OWNER_NAME — владелец (опционально)
 *   IMPORT_PRICE_SHEET — путь к CSV прайса
 */
const fs = require("node:fs");
const path = require("node:path");

const { getDB } = require("../config/database");
const { applyMigrations } = require("../config/migrations");
const { seedDefaultPermissions } = require("../config/permissions");
const { hashPassword } = require("../lib/password");
const { ensureDefaultSettings } = require("../lib/settings");
const { defaultPriceSheetPath, importPriceSheet } = require("../lib/importPriceSheet");
const { sqlNow } = require("../config/sqlDialect");

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

function resolveCsvPath() {
  return process.argv.find((a) => a.endsWith(".csv")) || defaultPriceSheetPath();
}

async function seedOwner(db) {
  const username = getArg("--username") || process.env.OWNER_USERNAME;
  const password = getArg("--password") || process.env.OWNER_PASSWORD;
  const name = getArg("--name") || process.env.OWNER_NAME || "Owner";

  if (!username || !password) {
    console.warn(
      "setup-database: owner skipped (set OWNER_USERNAME/OWNER_PASSWORD or --username/--password)"
    );
    return { skipped: true };
  }

  const passwordHash = hashPassword(password);
  const now = sqlNow(db.dialect);
  await db.query(
    `
    INSERT INTO users(username, password_hash, name, role, is_active)
    VALUES (?, ?, ?, 'owner', 1)
    ON CONFLICT(username) DO UPDATE SET
      password_hash=excluded.password_hash,
      name=excluded.name,
      role='owner',
      is_active=1,
      updated_at=${now}
  `,
    [username, passwordHash, name]
  );
  return { skipped: false, username };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const skipOwner = process.argv.includes("--skip-owner");
  const skipCatalog = process.argv.includes("--skip-catalog");
  const csvPath = resolveCsvPath();

  if (!process.env.SQLITE_PATH && !process.env.DATABASE_URL) {
    process.env.SQLITE_PATH = path.join(__dirname, "..", "data", "autoservice.sqlite3");
  }

  if (!skipCatalog && !fs.existsSync(csvPath)) {
    throw new Error(`CSV прайса не найден: ${csvPath}`);
  }

  const db = await getDB();
  const dialect = db.dialect;

  console.log(`[1/4] Миграции (${dialect})…`);
  await applyMigrations(db);

  console.log("[2/4] Права и настройки…");
  await seedDefaultPermissions(db);
  await ensureDefaultSettings(db);

  if (!skipOwner) {
    console.log("[3/4] Владелец…");
    const owner = await seedOwner(db);
    if (!owner.skipped) {
      console.log(`  создан/обновлён: ${owner.username}`);
    }
  } else {
    console.log("[3/4] Владелец — пропуск (--skip-owner)");
  }

  if (skipCatalog) {
    console.log("[4/4] Каталог — пропуск (--skip-catalog)");
  } else {
    console.log(`[4/4] Карточки каталога из ${csvPath}…`);
    if (dryRun) {
      const { readPriceSheetCsv } = require("../lib/importPriceSheet");
      const items = readPriceSheetCsv(csvPath);
      console.log(
        JSON.stringify(
          { dryRun: true, dialect, csvPath, catalogItems: items.length },
          null,
          2
        )
      );
    } else {
      const result = await importPriceSheet(db, csvPath);
      console.log(
        JSON.stringify(
          {
            dialect,
            csvPath: result.csvPath,
            catalogItems: result.items,
            created: result.created,
            updated: result.updated
          },
          null,
          2
        )
      );
    }
  }

  await db.close();
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
