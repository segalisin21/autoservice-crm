const PLATE_LETTERS = "АВЕКМНОРСТУХ";
const LATIN_TO_CYR = {
  A: "А",
  B: "В",
  C: "С",
  E: "Е",
  H: "Н",
  K: "К",
  M: "М",
  O: "О",
  P: "Р",
  T: "Т",
  X: "Х",
  Y: "У"
};

function mapPlateChar(ch) {
  const upper = String(ch).toUpperCase();
  if (PLATE_LETTERS.includes(upper)) return upper;
  if (LATIN_TO_CYR[upper]) return LATIN_TO_CYR[upper];
  return null;
}

function extractPlateParts(raw) {
  const letters = [];
  const digits = [];
  for (const ch of String(raw ?? "")) {
    if (/\d/.test(ch)) {
      digits.push(ch);
      continue;
    }
    const mapped = mapPlateChar(ch);
    if (mapped) letters.push(mapped);
  }
  return { letters, digits };
}

function assemblePlate(letters, digits) {
  const l = letters.slice(0, 3);
  const d = digits.slice(0, 8);
  if (!l.length && !d.length) return "";

  const part1 = l[0] || "";
  const part2 = d.slice(0, 3).join("");
  const part3 = l.slice(1, 3).join("");
  const part4 = d.slice(3, 8).join("");

  let out = part1;
  if (part2) out += part2;
  if (part3) out += part3;
  if (part4) out += part4;
  return out;
}

function formatPlate(raw) {
  const { letters, digits } = extractPlateParts(raw);
  const formatted = assemblePlate(letters, digits);
  const normalized = formatted.toUpperCase().replace(/[\s-]/g, "");
  return { formatted, normalized };
}

function isCompletePlate(normalized) {
  return /^[АВЕКМНОРСТУХ]\d{3}[АВЕКМНОРСТУХ]{2}\d{2,3}$/.test(normalized);
}

function validatePlate(raw) {
  const { formatted, normalized } = formatPlate(raw);
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return { ok: true, formatted: "", normalized: "", error: null };
  if (!normalized) return { ok: false, formatted, normalized, error: "Некорректный госномер" };
  if (!isCompletePlate(normalized)) {
    return { ok: false, formatted, normalized, error: "Госномер: буква + 3 цифры + 2 буквы + 2–3 цифры региона" };
  }
  return { ok: true, formatted, normalized, error: null };
}

module.exports = {
  PLATE_LETTERS,
  mapPlateChar,
  extractPlateParts,
  assemblePlate,
  formatPlate,
  isCompletePlate,
  validatePlate
};
