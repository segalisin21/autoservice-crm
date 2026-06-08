const test = require("node:test");
const assert = require("node:assert/strict");

const { vehicleDisplayName, withVehicleDisplayNames } = require("../lib/vehicleNames");

test("vehicleDisplayName prefers original latin names", () => {
  const row = { name: "Toyota", name_ru: "Тойота" };
  assert.equal(vehicleDisplayName(row, "original"), "Toyota");
  assert.equal(vehicleDisplayName(row, "cyrillic"), "Тойота");
});

test("withVehicleDisplayNames adds display_name to rows", () => {
  const rows = withVehicleDisplayNames([{ name: "Camry", name_ru: "Камри" }], "original");
  assert.equal(rows[0].display_name, "Camry");
});
