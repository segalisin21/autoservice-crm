const test = require("node:test");
const assert = require("node:assert/strict");

const {
  formatPlate,
  validatePlate,
  assemblePlate,
  mapPlateChar
} = require("../lib/plateFormat");

test("mapPlateChar converts latin lookalikes", () => {
  assert.equal(mapPlateChar("a"), "А");
  assert.equal(mapPlateChar("B"), "В");
  assert.equal(mapPlateChar("x"), "Х");
});

test("lazy input ABC123777 formats to Russian plate", () => {
  const { formatted, normalized } = formatPlate("abc123777");
  assert.equal(normalized, "А123ВС777");
  assert.equal(formatted, "А123ВС777");
});

test("standard spaced input normalizes", () => {
  const { normalized } = formatPlate("а 123 вс 77");
  assert.equal(normalized, "А123ВС77");
});

test("validatePlate rejects incomplete plate", () => {
  const r = validatePlate("А12");
  assert.equal(r.ok, false);
  assert.match(r.error, /Госномер/);
});

test("validatePlate accepts empty", () => {
  const r = validatePlate("");
  assert.equal(r.ok, true);
});

test("assemblePlate builds pattern", () => {
  assert.equal(assemblePlate(["А", "В", "С"], ["1", "2", "3", "7", "7", "7"]), "А123ВС777");
});
