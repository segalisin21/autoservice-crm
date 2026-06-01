const path = require("node:path");
const fs = require("node:fs");

const Database = require("better-sqlite3");
const { Client } = require("pg");

function isProbablyPostgresUrl(url) {
  return typeof url === "string" && (url.startsWith("postgres://") || url.startsWith("postgresql://"));
}

function convertQMarksToPg(sql) {
  // Minimal converter: replaces each `?` outside of quotes with $1..$n.
  // Good enough for this project as long as we don't embed `?` in SQL strings.
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

async function createDb() {
  const url = process.env.DATABASE_URL;

  if (isProbablyPostgresUrl(url)) {
    const client = new Client({ connectionString: url });
    await client.connect();
    return {
      dialect: "postgres",
      async exec(sql) {
        await client.query(sql);
      },
      async query(sql, params = []) {
        const pgSql = convertQMarksToPg(sql);
        const res = await client.query(pgSql, params);
        return res.rows;
      },
      async close() {
        await client.end();
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
      // Heuristic: treat SELECT/WITH/PRAGMA as returning rows, otherwise run.
      const head = sql.trimStart().slice(0, 6).toUpperCase();
      if (head === "SELECT" || head === "WITH  " || head === "PRAGMA") {
        return stmt.all(params);
      }
      stmt.run(params);
      return [];
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

module.exports = { getDB, resetDB };

