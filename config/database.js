const path = require("node:path");
const fs = require("node:fs");

const Database = require("better-sqlite3");
const { Pool } = require("pg");

function isProbablyPostgresUrl(url) {
  return typeof url === "string" && (url.startsWith("postgres://") || url.startsWith("postgresql://"));
}

function convertQMarksToPg(sql) {
  let out = "";
  let idx = 0;
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      out += ch;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      out += ch;
      continue;
    }
    if (ch === "?" && !inSingle && !inDouble) {
      idx += 1;
      out += `$${idx}`;
      continue;
    }
    out += ch;
  }
  return out;
}

function returnsRows(sql) {
  const head = sql.trimStart().slice(0, 6).toUpperCase();
  return head === "SELECT" || head === "WITH  " || head === "PRAGMA" || /\bRETURNING\b/i.test(sql);
}

async function createDb() {
  const url = process.env.DATABASE_URL;

  if (isProbablyPostgresUrl(url)) {
    const pool = new Pool({
      connectionString: url,
      ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false }
    });

    return {
      dialect: "postgres",
      async exec(sql) {
        await pool.query(sql);
      },
      async query(sql, params = []) {
        const pgSql = convertQMarksToPg(sql);
        const res = await pool.query(pgSql, params);
        return res.rows;
      },
      async insertReturning(sql, params = []) {
        const trimmed = sql.trim().replace(/;\s*$/, "");
        const withReturning = /\bRETURNING\b/i.test(trimmed) ? trimmed : `${trimmed} RETURNING id`;
        const pgSql = convertQMarksToPg(withReturning);
        const res = await pool.query(pgSql, params);
        return res.rows[0]?.id ?? null;
      },
      async close() {
        await pool.end();
      }
    };
  }

  const dbPath = process.env.SQLITE_PATH || path.join(__dirname, "..", "data", "dev.sqlite3");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  return {
    dialect: "sqlite",
    async exec(sql) {
      sqlite.exec(sql);
    },
    async query(sql, params = []) {
      const stmt = sqlite.prepare(sql);
      if (returnsRows(sql)) {
        return stmt.all(params);
      }
      stmt.run(params);
      return [];
    },
    async insertReturning(sql, params = []) {
      const trimmed = sql.trim().replace(/;\s*$/, "");
      const withReturning = /\bRETURNING\b/i.test(trimmed) ? trimmed : `${trimmed} RETURNING id`;
      const stmt = sqlite.prepare(withReturning);
      const row = stmt.get(params);
      return row?.id ?? null;
    },
    async close() {
      sqlite.close();
    }
  };
}

let _dbPromise;
function getDB() {
  if (!_dbPromise) _dbPromise = createDb();
  return _dbPromise;
}

function resetDB() {
  _dbPromise = null;
}

module.exports = { getDB, resetDB, isProbablyPostgresUrl };
