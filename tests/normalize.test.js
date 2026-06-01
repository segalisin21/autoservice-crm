const test = require("node:test");
const assert = require("node:assert/strict");

const { normalizePhone, normalizePlate } = require("../lib/normalize");

test("normalizePhone RU rules", () => {
  assert.deepEqual(normalizePhone("8 (999) 111-22-33"), {
    phone_raw: "8 (999) 111-22-33",
    phone_normalized: "79991112233"
  });
  assert.deepEqual(normalizePhone("9991112233").phone_normalized, "79991112233");
});

test("normalizePlate uppercases and strips spaces", () => {
  assert.deepEqual(normalizePlate("а 123 вс 77"), {
    license_plate_raw: "а 123 вс 77",
    license_plate_normalized: "А123ВС77"
  });
});
