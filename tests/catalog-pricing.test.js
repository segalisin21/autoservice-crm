const test = require("node:test");
const assert = require("node:assert/strict");

const { materialForVehicleTier, priceForVehicleTier } = require("../lib/catalogPricing");

test("materialForVehicleTier picks tier-specific consumable", () => {
  const item = {
    default_price: 5000,
    price_tier_2: 6500,
    price_tier_3: 7000,
    default_material_cost: 2000,
    material_cost_tier_2: 2500,
    material_cost_tier_3: 3000
  };
  assert.equal(priceForVehicleTier(item, 2), 6500);
  assert.equal(materialForVehicleTier(item, 2), 2500);
  assert.equal(materialForVehicleTier(item, 3), 3000);
  assert.equal(materialForVehicleTier(item, 1), 2000);
});

test("materialForVehicleTier falls back to tier 1 when tier override empty", () => {
  const item = {
    default_material_cost: 1500,
    material_cost_tier_2: null,
    material_cost_tier_3: null
  };
  assert.equal(materialForVehicleTier(item, 2), 1500);
  assert.equal(materialForVehicleTier(item, 3), 1500);
});
