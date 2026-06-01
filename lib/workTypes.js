const WORK_TYPES = ["Мойка", "Электрика", "Продажа"];

function lineTypeForWorkType(workType) {
  if (workType === "Продажа") return "product";
  return "work";
}

function normalizeWorkType(value) {
  const v = String(value ?? "").trim();
  if (!v) return "Электрика";
  const found = WORK_TYPES.find((t) => t.toLowerCase() === v.toLowerCase());
  return found || v;
}

module.exports = { WORK_TYPES, lineTypeForWorkType, normalizeWorkType };
