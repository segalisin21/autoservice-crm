const WORK_TYPES = ["Мойка", "Электрика", "Продажа"];
const WORK_TYPE_SEP = ", ";

function matchWorkType(value) {
  const v = String(value ?? "").trim();
  if (!v) return null;
  return WORK_TYPES.find((t) => t.toLowerCase() === v.toLowerCase()) || null;
}

function parseWorkTypes(value) {
  if (Array.isArray(value)) {
    return WORK_TYPES.filter((t) => value.some((v) => matchWorkType(v) === t));
  }
  const raw = String(value ?? "").trim();
  if (!raw) return [];
  const parts = raw.split(WORK_TYPE_SEP).map((p) => p.trim()).filter(Boolean);
  const seen = new Set();
  const out = [];
  for (const part of parts) {
    const matched = matchWorkType(part);
    if (matched && !seen.has(matched)) {
      seen.add(matched);
      out.push(matched);
    }
  }
  return WORK_TYPES.filter((t) => seen.has(t));
}

function serializeWorkTypes(types) {
  const parsed = parseWorkTypes(types);
  return parsed.length ? parsed.join(WORK_TYPE_SEP) : "";
}

function normalizeWorkTypesFromBody(body) {
  return serializeWorkTypes(parseWorkTypes(body?.work_type));
}

function orderHasWorkType(stored, type) {
  const filter = matchWorkType(type);
  if (!filter) return false;
  return parseWorkTypes(stored).includes(filter);
}

function primaryWorkType(stored) {
  const types = parseWorkTypes(stored);
  if (!types.length) return "Электрика";
  if (types.length === 1) return types[0];
  const nonSale = types.find((t) => t !== "Продажа");
  return nonSale || types[0];
}

function lineTypeForWorkType(workType) {
  if (primaryWorkType(workType) === "Продажа") return "product";
  return "work";
}

function normalizeWorkType(value) {
  const types = parseWorkTypes(value);
  if (types.length) return serializeWorkTypes(types);
  const v = String(value ?? "").trim();
  if (!v) return "Электрика";
  const found = matchWorkType(v);
  return found || v;
}

module.exports = {
  WORK_TYPES,
  WORK_TYPE_SEP,
  parseWorkTypes,
  serializeWorkTypes,
  normalizeWorkTypesFromBody,
  orderHasWorkType,
  primaryWorkType,
  lineTypeForWorkType,
  normalizeWorkType
};
