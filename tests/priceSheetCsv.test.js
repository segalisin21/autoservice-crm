const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { splitNameDescription, readPriceSheetCsv } = require("../lib/priceSheetCsv");

test("splitNameDescription splits complex premium package", () => {
  const raw =
    'Комплекс «Премиум» -комплекс базовый -чистка резины, чернение -полироль пластика';
  const { name, description } = splitNameDescription(raw);
  assert.match(name, /Премиум/i);
  assert.match(description, /базовый/);
  assert.match(description, /•/);
});

test("splitNameDescription keeps simple service name", () => {
  const { name, description } = splitNameDescription("Пылесос");
  assert.equal(name, "Пылесос");
  assert.equal(description, null);
});

test("readPriceSheetCsv parses tiers for moyka item", () => {
  const csvPath = path.join(__dirname, "..", "Прайс от 12.2025 - Лист1.csv");
  const items = readPriceSheetCsv(csvPath);
  const premium = items.find((i) => /премиум/i.test(i.name));
  assert.ok(premium, "Комплекс Премиум found");
  assert.equal(premium.default_price, 5000);
  assert.equal(premium.price_tier_2, 5500);
  assert.equal(premium.price_tier_3, 6000);
  assert.ok(premium.description && premium.description.includes("базовый"));
  const vacuum = items.find((i) => i.name === "Пылесос");
  assert.ok(vacuum);
  assert.equal(vacuum.default_price, 500);
  assert.equal(vacuum.price_tier_3, 800);
});
