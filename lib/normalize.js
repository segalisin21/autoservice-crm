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
  const license_plate_raw = String(raw ?? "").trim();
  const license_plate_normalized = license_plate_raw.toUpperCase().replace(/[\s-]/g, "");
  return { license_plate_raw, license_plate_normalized };
}

function normalizeVin(raw) {
  const vin = String(raw ?? "").trim().toUpperCase().replace(/\s/g, "");
  return vin || null;
}

module.exports = { normalizePhone, normalizePlate, normalizeVin };
