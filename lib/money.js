function parseMoney(value) {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(String(value).trim().replace(",", "."));
  if (!Number.isFinite(n)) return 0;
  return round2(n);
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

module.exports = { parseMoney, round2 };
