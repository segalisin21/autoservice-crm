const fs = require("node:fs");

const { parsePrice } = require("./uchetCsv");
const { parseOptionalTierPrice } = require("./catalogPricing");

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

function normalizeQuotes(text) {
  return String(text)
    .replace(/""/g, "\u0001")
    .replace(/"([^"]*)"/g, "«$1»")
    .replace(/\u0001/g, "»");
}

const SECTION_HEADERS = new Set(
  ["мойка/детейлинг", "химчистка", "электрика", "комплексы", "за комплект"].map((s) => s.toLowerCase())
);

function looksLikePriceOnly(text) {
  const s = String(text ?? "").trim();
  if (!s) return true;
  if (/^от\s*[\d,.]/i.test(s)) return true;
  if (/^[\d,.]+\s*\/\s*[\d,.]+/.test(s)) return true;
  if (/^[\d,.]+\s*(\/час|₽|руб)/i.test(s)) return true;
  if (/^[\d,.]+$/.test(s.replace(/\s/g, ""))) return true;
  return false;
}

function splitNameDescription(raw) {
  let text = normalizeQuotes(String(raw ?? "")).replace(/\s+/g, " ").trim();
  if (!text) return { name: "", description: null };

  const lower = text.toLowerCase();
  if (lower === "комплексы") return { name: "", description: null };

  const dashParts = text
    .split(/\s+-\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (dashParts.length >= 2 && /^комплекс/i.test(dashParts[0])) {
    return {
      name: dashParts[0].trim(),
      description: dashParts
        .slice(1)
        .map((p) => `• ${p.trim()}`)
        .join("\n")
    };
  }
  if (dashParts.length >= 3) {
    return {
      name: dashParts[0].trim(),
      description: dashParts
        .slice(1)
        .map((p) => `• ${p.trim()}`)
        .join("\n")
    };
  }
  return { name: text, description: null };
}

function parsePriceCell(raw, fallbackDescription) {
  const s = String(raw ?? "").trim();
  if (!s) return { price: null, descriptionExtra: null };
  const price = parseOptionalTierPrice(s) ?? (parsePrice(s) || null);
  if (price != null && price > 0) {
    const stripped = s.replace(/[\d\s,.-]/gi, "").trim();
    if (stripped.length > 3 && !/^от$/i.test(stripped)) {
      return { price, descriptionExtra: stripped };
    }
    return { price, descriptionExtra: null };
  }
  return { price: null, descriptionExtra: s };
}

function appendDescription(base, extra) {
  const parts = [];
  if (base) parts.push(base);
  if (extra) parts.push(extra.startsWith("•") ? extra : `• ${extra}`);
  return parts.length ? parts.join("\n") : null;
}

function buildItem(category, rawName, priceCells, extraDescCols) {
  const raw = String(rawName ?? "").trim();
  if (!raw || looksLikePriceOnly(raw) || SECTION_HEADERS.has(raw.toLowerCase())) return null;

  const { name, description: nameDesc } = splitNameDescription(raw);
  if (!name || looksLikePriceOnly(name) || SECTION_HEADERS.has(name.toLowerCase())) return null;

  const p1 = parsePriceCell(priceCells[0]);
  const p2 = parsePriceCell(priceCells[1]);
  const p3 = parsePriceCell(priceCells[2]);

  let description = nameDesc;
  for (const extra of extraDescCols || []) {
    const t = String(extra ?? "").trim();
    if (t) description = appendDescription(description, t);
  }
  for (const p of [p1, p2, p3]) {
    if (p.descriptionExtra) description = appendDescription(description, p.descriptionExtra);
  }

  const t1 = p1.price;
  const t2 = p2.price;
  const t3 = p3.price;

  return {
    type: "work",
    category,
    name,
    description,
    default_price: t1 ?? t2 ?? t3 ?? 0,
    price_tier_2: t2 != null && t2 > 0 ? t2 : null,
    price_tier_3: t3 != null && t3 > 0 ? t3 : null
  };
}

function readPriceSheetCsv(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const items = [];
  const seen = new Set();

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);

    const moyka = buildItem("Мойка", cols[0], [cols[1], cols[2], cols[3]], []);
    if (moyka && moyka.name) {
      const key = `Мойка|${moyka.name.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        items.push(moyka);
      }
    }

    const him = buildItem("Химчистка", cols[5], [cols[6]], [cols[7]]);
    if (him && him.name) {
      const key = `Химчистка|${him.name.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        items.push(him);
      }
    }

    const elec1 = buildItem("Электрика", cols[9], [cols[10]], []);
    if (elec1 && elec1.name) {
      const key = `Электрика|${elec1.name.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        items.push(elec1);
      }
    }

    const elec2 = buildItem("Электрика", cols[12], [cols[13]], []);
    if (elec2 && elec2.name) {
      const key = `Электрика|${elec2.name.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        items.push(elec2);
      }
    }
  }

  return items;
}

module.exports = {
  parseCsvLine,
  splitNameDescription,
  readPriceSheetCsv
};
