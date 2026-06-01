const fs = require("node:fs");

const { parseMoney } = require("./money");
const { normalizeWorkType, lineTypeForWorkType } = require("./workTypes");

function parseCsvLine(line) {
  const result = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      result.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  result.push(cur.trim());
  return result;
}

function parseDateRu(raw) {
  const s = String(raw ?? "")
    .trim()
    .replace(/,/g, ".")
    .replace(/\s/g, "");
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (!m) return null;
  let [, d, mo, y] = m;
  let year = Number(y);
  if (year < 100) year += 2000;
  const dd = String(d).padStart(2, "0");
  const mm = String(mo).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function parsePrice(raw) {
  const cleaned = String(raw ?? "")
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "-----") return 0;
  return parseMoney(cleaned);
}

function readUchetCsv(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (!cols.length) continue;
    rows.push({
      dateRaw: cols[0] || "",
      workType: normalizeWorkType(cols[1] || ""),
      car: String(cols[2] || "").trim(),
      master: String(cols[3] || "").trim(),
      service: String(cols[4] || "").trim(),
      price: parsePrice(cols[5]),
      payment: cols[6] ? parsePrice(cols[6]) : null,
      note: String(cols[7] || "").trim() || null
    });
  }
  return rows;
}

function pickPrimaryMaster(lines) {
  const counts = new Map();
  for (const l of lines) {
    const name = String(l.master || "").trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  let best = null;
  let bestCount = 0;
  for (const [name, cnt] of counts) {
    if (cnt > bestCount) {
      best = name;
      bestCount = cnt;
    }
  }
  return best;
}

function buildOrderGroups(rows) {
  let lastDate = null;
  let lastCar = null;
  const groups = [];
  let current = null;

  function flush() {
    if (current && current.lines.length) {
      current.primaryMaster = pickPrimaryMaster(current.lines);
      groups.push(current);
    }
    current = null;
  }

  for (const row of rows) {
    const date = parseDateRu(row.dateRaw) || lastDate;
    if (row.dateRaw && parseDateRu(row.dateRaw)) {
      lastDate = parseDateRu(row.dateRaw);
    }
    if (row.car) lastCar = row.car;
    if (!lastDate) continue;

    const car = row.car || lastCar || "";
    const key = `${lastDate}|${car.toLowerCase()}`;

    if (!current || current.key !== key) {
      flush();
      current = {
        key,
        date: lastDate,
        car,
        workType: row.workType,
        lines: [],
        payment: null,
        note: null,
        primaryMaster: null
      };
    }

    if (row.workType && row.workType !== current.workType) {
      // mixed types same car/day — keep first, lines can have own type
    }

    if (row.service || row.price > 0) {
      current.lines.push({
        workType: row.workType,
        lineType: lineTypeForWorkType(row.workType),
        master: row.master,
        service: row.service || "Работа",
        price: row.price,
        note: row.note
      });
    }

    if (row.payment !== null && row.payment > 0) {
      current.payment = row.payment;
    }
    if (row.note && !current.note) {
      current.note = row.note;
    }
  }
  flush();
  return groups;
}

function collectCatalogItems(rows) {
  const map = new Map();
  for (const row of rows) {
    if (!row.service) continue;
    const workType = normalizeWorkType(row.workType);
    const key = `${workType}|${row.service.toLowerCase()}`;
    const prev = map.get(key);
    const price = row.price || 0;
    if (!prev || price > prev.default_price) {
      map.set(key, {
        workType,
        type: lineTypeForWorkType(workType),
        category: workType,
        name: row.service,
        default_price: price
      });
    }
  }
  return [...map.values()];
}

function collectMasters(rows) {
  const set = new Set();
  for (const row of rows) {
    const name = String(row.master || "").trim();
    if (name) set.add(name);
  }
  return [...set];
}

module.exports = {
  readUchetCsv,
  buildOrderGroups,
  collectCatalogItems,
  collectMasters,
  parseDateRu,
  parsePrice
};
