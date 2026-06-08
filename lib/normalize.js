const { formatPlate, validatePlate } = require("./plateFormat");

function normalizePhone(raw) {
  const phone_raw = String(raw ?? "").trim();
  let digits = phone_raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("8")) {
    digits = `7${digits.slice(1)}`;
  } else if (digits.length === 10) {
    digits = `7${digits}`;
  }
  return { phone_raw, phone_normalized: digits };
}

function normalizePlate(raw) {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) {
    return { license_plate_raw: "", license_plate_normalized: "" };
  }
  const { formatted, normalized } = formatPlate(trimmed);
  return {
    license_plate_raw: formatted || trimmed,
    license_plate_normalized: normalized
  };
}

function normalizePlateStrict(raw) {
  const result = validatePlate(raw);
  if (!result.ok && String(raw ?? "").trim()) {
    return { error: result.error, ...result };
  }
  return {
    error: null,
    license_plate_raw: result.formatted || "",
    license_plate_normalized: result.normalized || ""
  };
}

function normalizeVin(raw) {
  const vin = String(raw ?? "").trim().toUpperCase().replace(/\s/g, "");
  return vin || null;
}

module.exports = { normalizePhone, normalizePlate, normalizePlateStrict, normalizeVin };
