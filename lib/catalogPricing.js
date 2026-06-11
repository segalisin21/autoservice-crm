const { parseMoney } = require("./money");

function hasVehicleTiers(item) {
  if (!item) return false;
  const t2 = item.price_tier_2;
  const t3 = item.price_tier_3;
  return (t2 != null && t2 !== "" && Number(t2) > 0) || (t3 != null && t3 !== "" && Number(t3) > 0);
}

function normalizeVehicleTier(value) {
  const n = Number(value);
  if (n === 2 || n === 3) return n;
  return 1;
}

function priceForVehicleTier(item, tier) {
  if (!item) return 0;
  const t = normalizeVehicleTier(tier);
  if (t === 2 && item.price_tier_2 != null && item.price_tier_2 !== "") {
    return parseMoney(item.price_tier_2);
  }
  if (t === 3 && item.price_tier_3 != null && item.price_tier_3 !== "") {
    return parseMoney(item.price_tier_3);
  }
  return parseMoney(item.default_price);
}

function parseOptionalTierPrice(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const n = parseMoney(s.replace(/[^\d,.-]/g, "").replace(",", "."));
  return n > 0 ? n : null;
}

module.exports = {
  hasVehicleTiers,
  normalizeVehicleTier,
  priceForVehicleTier,
  parseOptionalTierPrice
};
