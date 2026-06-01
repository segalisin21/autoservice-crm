const { getDB } = require("../config/database");

async function getSetting(db, key, fallback = null) {
  const rows = await db.query("SELECT value FROM settings WHERE key = ? LIMIT 1", [key]);
  if (!rows.length) return fallback;
  return rows[0].value;
}

async function loadTaxSettings(db) {
  const tax_enabled = Number(await getSetting(db, "tax_enabled", "0")) ? 1 : 0;
  const tax_mode = (await getSetting(db, "tax_mode", "vat")) || "vat";
  const tax_rate = Number(await getSetting(db, "tax_rate", "20")) || 0;
  const prices_include_tax = Number(await getSetting(db, "prices_include_tax", "0")) ? 1 : 0;
  return { tax_enabled, tax_mode, tax_rate, prices_include_tax };
}

async function loadPayrollSettings(db) {
  const mode = (await getSetting(db, "payroll_default_mode", "net_percent")) || "net_percent";
  const value = Number(await getSetting(db, "payroll_default_value", "50"));
  return {
    mode,
    value: Number.isFinite(value) ? value : 50
  };
}

async function ensureDefaultSettings(db) {
  const defaults = [
    ["tax_enabled", "0"],
    ["tax_mode", "vat"],
    ["tax_rate", "20"],
    ["prices_include_tax", "0"],
    ["payroll_default_mode", "net_percent"],
    ["payroll_default_value", "50"]
  ];
  for (const [key, value] of defaults) {
    await db.query(
      `INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING`,
      [key, value]
    );
  }
}

module.exports = { getSetting, loadTaxSettings, loadPayrollSettings, ensureDefaultSettings };
