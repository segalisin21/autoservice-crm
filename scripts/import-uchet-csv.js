const path = require("node:path");

const { getDB, resetDB } = require("../config/database");
const { applyMigrations } = require("../config/migrations");
const { ensureDefaultSettings } = require("../lib/settings");
const { seedDefaultPermissions } = require("../config/permissions");
const { hashPassword } = require("../lib/password");
const { recomputeOrderTotals } = require("../lib/orderTotals");
const { freezeOrderEarned } = require("../lib/payroll");
const {
  readUchetCsv,
  buildOrderGroups,
  collectCatalogItems,
  collectMasters
} = require("../lib/uchetCsv");

async function ensureClient(db, name) {
  const rows = await db.query("SELECT id FROM clients WHERE full_name = ? LIMIT 1", [name]);
  if (rows[0]) return rows[0].id;
  await db.query(
    `INSERT INTO clients(full_name, phone_raw, phone_normalized) VALUES (?, '-', '70000000000')`,
    [name]
  );
  const created = await db.query("SELECT id FROM clients WHERE full_name = ? LIMIT 1", [name]);
  return created[0].id;
}

async function ensureCar(db, clientId, carLabel) {
  const rows = await db.query(`SELECT id FROM cars WHERE client_id = ? AND make = ? LIMIT 1`, [clientId, carLabel]);
  if (rows[0]) return rows[0].id;
  await db.query(`INSERT INTO cars(client_id, make, model, license_plate_raw) VALUES (?, ?, '', ?)`, [
    clientId,
    carLabel,
    carLabel
  ]);
  const created = await db.query("SELECT id FROM cars WHERE client_id = ? AND make = ? LIMIT 1", [clientId, carLabel]);
  return created[0].id;
}

function isOwnerName(name) {
  return String(name || "").trim().toLowerCase() === "виталик";
}

async function ensureMaster(db, name, index) {
  const rows = await db.query("SELECT id FROM users WHERE name = ? LIMIT 1", [name]);
  if (rows[0]) return rows[0].id;
  const owner = isOwnerName(name);
  const username = owner ? "vitalik" : `master_${index}`;
  const role = owner ? "owner" : "master";
  const password_hash = hashPassword("master");
  await db.query(
    `INSERT INTO users(username, password_hash, name, role, is_active) VALUES (?, ?, ?, ?, 1)`,
    [username, password_hash, name, role]
  );
  const created = await db.query("SELECT id FROM users WHERE name = ? LIMIT 1", [name]);
  return created[0].id;
}

async function upsertCatalog(db, items) {
  for (const item of items) {
    const existing = await db.query(
      `SELECT id FROM catalog_items WHERE type = ? AND category = ? AND name = ? LIMIT 1`,
      [item.type, item.category, item.name]
    );
    if (existing[0]) {
      await db.query(`UPDATE catalog_items SET default_price = ? WHERE id = ?`, [item.default_price, existing[0].id]);
    } else {
      await db.query(
        `INSERT INTO catalog_items(type, category, name, default_price, unit, is_active) VALUES (?, ?, ?, ?, 'шт', 1)`,
        [item.type, item.category, item.name, item.default_price]
      );
    }
  }
}

async function findCatalogId(db, workType, serviceName) {
  const rows = await db.query(
    `SELECT id, default_price FROM catalog_items WHERE category = ? AND name = ? LIMIT 1`,
    [workType, serviceName]
  );
  return rows[0] || null;
}

async function main() {
  const fs = require("node:fs");
  const csvPath =
    process.argv[2] || process.env.IMPORT_CSV || path.join(__dirname, "..", "Учет - Лист1 (1).csv");

  const db = await getDB();
  await applyMigrations(db);
  await seedDefaultPermissions(db);
  await ensureDefaultSettings(db);

  // Idempotency guard: do not duplicate on re-runs (safe for prod boot).
  const existing = await db.query("SELECT COUNT(*) AS c FROM orders");
  if (Number(existing[0].c) > 0) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ skipped: true, reason: "orders already present", orders: Number(existing[0].c) }));
    await db.close();
    return;
  }

  if (!fs.existsSync(csvPath)) {
    // eslint-disable-next-line no-console
    console.warn(`CSV not found, skipping import: ${csvPath}`);
    await db.close();
    return;
  }

  const rows = readUchetCsv(csvPath);
  const groups = buildOrderGroups(rows);
  const catalogItems = collectCatalogItems(rows);
  const masters = collectMasters(rows);

  await upsertCatalog(db, catalogItems);

  const masterIds = {};
  for (let i = 0; i < masters.length; i++) {
    masterIds[masters[i].toLowerCase()] = await ensureMaster(db, masters[i], i + 1);
  }

  const importClientId = await ensureClient(db, "Учёт (импорт)");

  let ordersCount = 0;
  let linesCount = 0;

  for (const group of groups) {
    if (!group.car) continue;
    const carId = await ensureCar(db, importClientId, group.car);
    const openedAt = `${group.date} 12:00:00`;
    const assignedUserId = group.primaryMaster
      ? masterIds[group.primaryMaster.toLowerCase()] || null
      : null;

    const orderId = await db.insertReturning(
      `
      INSERT INTO orders(
        car_id, opened_at, closed_at, scheduled_date, assigned_user_id,
        status, work_type, notes,
        tax_enabled, tax_rate, prices_include_tax
      ) VALUES (?, ?, ?, ?, ?, 'completed', ?, ?, 0, 0, 0)
    `,
      [carId, openedAt, openedAt, group.date, assignedUserId, group.workType, group.note]
    );
    ordersCount += 1;

    for (const line of group.lines) {
      const cat = await findCatalogId(db, line.workType, line.service);
      const masterKey = line.master.toLowerCase();
      const masterId = masterIds[masterKey] || null;
      const unitPrice = line.price || (cat ? Number(cat.default_price) : 0);
      const qty = 1;
      const total = unitPrice * qty;

      await db.query(
        `
        INSERT INTO order_lines(
          order_id, line_type, catalog_item_id, name, quantity, unit_price, total,
          master_id, work_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'done')
      `,
        [
          orderId,
          line.lineType,
          cat ? cat.id : null,
          line.service,
          qty,
          unitPrice,
          total,
          masterId
        ]
      );
      linesCount += 1;
    }

    await recomputeOrderTotals(orderId);
    await freezeOrderEarned(orderId);

    if (group.payment && group.payment > 0) {
      await db.query(
        `INSERT INTO payments(order_id, amount, method, kind, paid_at) VALUES (?, ?, 'cash', 'payment', ?)`,
        [orderId, group.payment, openedAt]
      );
    }
  }

  await db.close();
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        csvPath,
        rows: rows.length,
        orders: ordersCount,
        lines: linesCount,
        catalogItems: catalogItems.length,
        masters: masters.length
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err.message || err);
  process.exitCode = 1;
});
