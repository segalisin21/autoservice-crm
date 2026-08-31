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

function createSqliteApi(sqlite, dialect = "sqlite") {
  return {
    dialect,
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
    async withTransaction(fn) {
      sqlite.exec("BEGIN IMMEDIATE");
      const txDb = createSqliteApi(sqlite, dialect);
      try {
        const result = await fn(txDb);
        sqlite.exec("COMMIT");
        return result;
      } catch (err) {
        sqlite.exec("ROLLBACK");
        throw err;
      }
    },
    async close() {
      sqlite.close();
    }
  };
}

function createPostgresApi(pool) {
  async function queryWithClient(client, sql, params = []) {
    const pgSql = convertQMarksToPg(sql);
    const res = await client.query(pgSql, params);
    return res.rows;
  }

  function createClientApi(client) {
    return {
      dialect: "postgres",
      async exec(sql) {
        await client.query(convertQMarksToPg(sql));
      },
      async query(sql, params = []) {
        return queryWithClient(client, sql, params);
      },
      async insertReturning(sql, params = []) {
        const trimmed = sql.trim().replace(/;\s*$/, "");
        const withReturning = /\bRETURNING\b/i.test(trimmed) ? trimmed : `${trimmed} RETURNING id`;
        const rows = await queryWithClient(client, withReturning, params);
        return rows[0]?.id ?? null;
      }
    };
  }

  const db = {
    dialect: "postgres",
    async exec(sql) {
      await pool.query(convertQMarksToPg(sql));
    },
    async query(sql, params = []) {
      const res = await pool.query(convertQMarksToPg(sql), params);
      return res.rows;
    },
    async insertReturning(sql, params = []) {
      const trimmed = sql.trim().replace(/;\s*$/, "");
      const withReturning = /\bRETURNING\b/i.test(trimmed) ? trimmed : `${trimmed} RETURNING id`;
      const res = await pool.query(convertQMarksToPg(withReturning), params);
      return res.rows[0]?.id ?? null;
    },
    async withTransaction(fn) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const txDb = createClientApi(client);
        txDb.withTransaction = db.withTransaction.bind(db);
        const result = await fn(txDb);
        await client.query("COMMIT");
        return result;
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    }
  };

  return db;
}

async function createDb() {
  const url = process.env.DATABASE_URL;

  if (isProbablyPostgresUrl(url)) {
    const pool = new Pool({
      connectionString: url,
      ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false }
    });

    return createPostgresApi(pool);
  }

  const dbPath = process.env.SQLITE_PATH || path.join(__dirname, "..", "data", "dev.sqlite3");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  return createSqliteApi(sqlite);
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
